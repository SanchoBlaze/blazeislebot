const SQLite = require('better-sqlite3');
const config = require('config');
const sql = new SQLite('./db/twitch.sqlite');

class TwitchManager {
    constructor() {
        this.initDatabase();
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    initDatabase() {
        // Create subscriptions table
        const subscriptionsTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'subscriptions\';').get();
        if (!subscriptionsTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    twitch_username TEXT NOT NULL,
                    added_by TEXT NOT NULL,
                    added_at TEXT,
                    UNIQUE(guild_id, twitch_username)
                );
            `).run();
            sql.prepare('CREATE INDEX idx_subscriptions_guild ON subscriptions (guild_id);').run();
        }

        // Create stream status table
        const streamStatusTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'stream_status\';').get();
        if (!streamStatusTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE stream_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    twitch_username TEXT UNIQUE NOT NULL,
                    is_live BOOLEAN DEFAULT FALSE,
                    stream_title TEXT,
                    game_name TEXT,
                    viewer_count INTEGER,
                    started_at TEXT,
                    last_checked TEXT
                );
            `).run();
            sql.prepare('CREATE INDEX idx_stream_status_username ON stream_status (twitch_username);').run();
        }

        sql.pragma('synchronous = 1');
        sql.pragma('journal_mode = wal');
    }

    async getAccessToken() {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const clientId = config.get('Twitch.client_id');
            const clientSecret = config.get('Twitch.secret');

            if (!clientId || !clientSecret) {
                console.warn('Twitch credentials not configured');
                return null;
            }

            console.log('Requesting Twitch access token...');
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Twitch API error ${response.status}:`, errorText);
                throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);

            console.log('Successfully obtained Twitch access token');
            return this.accessToken;
        } catch (error) {
            console.error('Error getting Twitch access token:', error);
            return null;
        }
    }

    async addSubscription(guildId, channelId, twitchUsername, addedBy) {
        try {
            const stmt = sql.prepare(`
                INSERT OR REPLACE INTO subscriptions (guild_id, channel_id, twitch_username, added_by)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(guildId, channelId, twitchUsername.toLowerCase(), addedBy);
            return true;
        } catch (error) {
            console.error('Error adding subscription:', error);
            return false;
        }
    }

    async removeSubscription(guildId, twitchUsername) {
        try {
            const stmt = sql.prepare(`
                DELETE FROM subscriptions 
                WHERE guild_id = ? AND twitch_username = ?
            `);
            const result = stmt.run(guildId, twitchUsername.toLowerCase());
            return result.changes > 0;
        } catch (error) {
            console.error('Error removing subscription:', error);
            return false;
        }
    }

    async getSubscriptions(guildId) {
        try {
            const stmt = sql.prepare(`
                SELECT * FROM subscriptions 
                WHERE guild_id = ? 
                ORDER BY added_at DESC
            `);
            return stmt.all(guildId);
        } catch (error) {
            console.error('Error getting subscriptions:', error);
            return [];
        }
    }

    async getAllSubscriptions() {
        try {
            const stmt = sql.prepare(`
                SELECT DISTINCT twitch_username FROM subscriptions
            `);
            return stmt.all().map(row => row.twitch_username);
        } catch (error) {
            console.error('Error getting all subscriptions:', error);
            return [];
        }
    }

    async updateStreamStatus(twitchUsername, streamData) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                console.warn('No Twitch access token available');
                return false;
            }

            const clientId = config.get('Twitch.client_id');
            const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${twitchUsername}`, {
                headers: {
                    'Client-ID': clientId,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, clear it and try again
                    this.accessToken = null;
                    this.tokenExpiry = null;
                    return await this.updateStreamStatus(twitchUsername, streamData);
                }
                throw new Error(`Twitch API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const stream = data.data[0];
                const nowISOString = new Date().toISOString();
                const stmt = sql.prepare(`
                    INSERT OR REPLACE INTO stream_status 
                    (twitch_username, is_live, stream_title, game_name, viewer_count, started_at, last_checked)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                
                const isLive = stream.data.length > 0 ? 1 : 0; // Convert boolean to integer
                const title = stream.data[0].title ? String(stream.data[0].title) : null;
                const game = stream.data[0].game_name ? String(stream.data[0].game_name) : null;
                const viewers = stream.data[0].viewer_count ? Number(stream.data[0].viewer_count) : null;
                const startedAt = stream.data[0].started_at ? String(stream.data[0].started_at) : null;

                stmt.run(twitchUsername.toLowerCase(), isLive, title, game, viewers, startedAt, nowISOString);
                return true;
            }
            
            return false; // Stream is offline
        } catch (error) {
            console.error('Error updating stream status:', error);
            return false;
        }
    }

    async getStreamStatus(twitchUsername) {
        try {
            const stmt = sql.prepare(`
                SELECT * FROM stream_status 
                WHERE twitch_username = ?
            `);
            return stmt.get(twitchUsername.toLowerCase());
        } catch (error) {
            console.error('Error getting stream status:', error);
            return null;
        }
    }

    async getSubscriptionsForUser(twitchUsername) {
        try {
            const stmt = sql.prepare(`
                SELECT * FROM subscriptions 
                WHERE twitch_username = ?
            `);
            return stmt.all(twitchUsername.toLowerCase());
        } catch (error) {
            console.error('Error getting subscriptions for user:', error);
            return [];
        }
    }

    async checkStreamStatus(twitchUsername) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                console.warn('No Twitch access token available');
                return null;
            }

            const clientId = config.get('Twitch.client_id');
            const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${twitchUsername}`, {
                headers: {
                    'Client-ID': clientId,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, clear it and try again
                    this.accessToken = null;
                    this.tokenExpiry = null;
                    return await this.checkStreamStatus(twitchUsername);
                }
                throw new Error(`Twitch API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const stream = data.data[0];
                return {
                    title: stream.title,
                    game_name: stream.game_name,
                    viewer_count: stream.viewer_count,
                    started_at: stream.started_at
                };
            }
            
            return null; // Stream is offline
        } catch (error) {
            console.error('Error checking stream status:', error);
            return null;
        }
    }
}

module.exports = TwitchManager; 