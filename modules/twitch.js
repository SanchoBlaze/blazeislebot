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
                    last_checked TEXT,
                    notification_sent BOOLEAN DEFAULT FALSE,
                    stream_id TEXT
                );
            `).run();
            sql.prepare('CREATE INDEX idx_stream_status_username ON stream_status (twitch_username);').run();
        }

        // Create notification messages table
        const notificationMessagesTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'notification_messages\';').get();
        if (!notificationMessagesTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE notification_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    twitch_username TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    message_id TEXT NOT NULL,
                    stream_id TEXT NOT NULL,
                    created_at TEXT,
                    UNIQUE(twitch_username, guild_id, stream_id)
                );
            `).run();
            sql.prepare('CREATE INDEX idx_notification_messages_username ON notification_messages (twitch_username);').run();
            sql.prepare('CREATE INDEX idx_notification_messages_stream ON notification_messages (stream_id);').run();
        }

        // Add new columns if they don't exist (for existing databases)
        try {
            sql.prepare('ALTER TABLE stream_status ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;').run();
        } catch (e) {
            // Column already exists
        }
        
        try {
            sql.prepare('ALTER TABLE stream_status ADD COLUMN stream_id TEXT;').run();
        } catch (e) {
            // Column already exists
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
                return { isLive: false, streamData: null };
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
            const nowISOString = new Date().toISOString();
            
            if (data.data && data.data.length > 0) {
                const stream = data.data[0];
                
                // Check if we already have a record for this stream
                const existingStatus = await this.getStreamStatus(twitchUsername);
                
                if (existingStatus && existingStatus.stream_id === stream.id) {
                    // Update existing record, preserving notification_sent flag
                    const stmt = sql.prepare(`
                        UPDATE stream_status 
                        SET is_live = 1, stream_title = ?, game_name = ?, viewer_count = ?, last_checked = ?
                        WHERE twitch_username = ? AND stream_id = ?
                    `);
                    
                    const title = stream.title ? String(stream.title) : null;
                    const game = stream.game_name ? String(stream.game_name) : null;
                    const viewers = stream.viewer_count ? Number(stream.viewer_count) : null;

                    stmt.run(title, game, viewers, nowISOString, twitchUsername.toLowerCase(), stream.id);
                } else {
                    // Insert new record (new stream session)
                    const stmt = sql.prepare(`
                        INSERT OR REPLACE INTO stream_status 
                        (twitch_username, is_live, stream_title, game_name, viewer_count, started_at, last_checked, stream_id, notification_sent)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                    `);
                    
                    const isLive = 1; // Stream is live
                    const title = stream.title ? String(stream.title) : null;
                    const game = stream.game_name ? String(stream.game_name) : null;
                    const viewers = stream.viewer_count ? Number(stream.viewer_count) : null;
                    const startedAt = stream.started_at ? String(stream.started_at) : null;
                    const streamId = stream.id ? String(stream.id) : null;

                    stmt.run(twitchUsername.toLowerCase(), isLive, title, game, viewers, startedAt, nowISOString, streamId);
                }
                
                return { isLive: true, streamData: stream };
            } else {
                // Stream is offline - update status but keep notification_sent flag
                const stmt = sql.prepare(`
                    UPDATE stream_status 
                    SET is_live = 0, last_checked = ?
                    WHERE twitch_username = ?
                `);
                stmt.run(nowISOString, twitchUsername.toLowerCase());
                return { isLive: false, streamData: null };
            }
        } catch (error) {
            console.error('Error updating stream status:', error);
            return { isLive: false, streamData: null };
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

    async markNotificationSent(twitchUsername) {
        try {
            const stmt = sql.prepare(`
                UPDATE stream_status 
                SET notification_sent = 1
                WHERE twitch_username = ?
            `);
            stmt.run(twitchUsername.toLowerCase());
            return true;
        } catch (error) {
            console.error('Error marking notification sent:', error);
            return false;
        }
    }

    async resetNotificationSent(twitchUsername) {
        try {
            const stmt = sql.prepare(`
                UPDATE stream_status 
                SET notification_sent = 0
                WHERE twitch_username = ?
            `);
            stmt.run(twitchUsername.toLowerCase());
            return true;
        } catch (error) {
            console.error('Error resetting notification sent:', error);
            return false;
        }
    }

    async saveNotificationMessage(twitchUsername, guildId, channelId, messageId, streamId) {
        try {
            const stmt = sql.prepare(`
                INSERT OR REPLACE INTO notification_messages 
                (twitch_username, guild_id, channel_id, message_id, stream_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            stmt.run(twitchUsername.toLowerCase(), guildId, channelId, messageId, streamId, new Date().toISOString());
            return true;
        } catch (error) {
            console.error('Error saving notification message:', error);
            return false;
        }
    }

    async getNotificationMessages(twitchUsername, streamId) {
        try {
            const stmt = sql.prepare(`
                SELECT * FROM notification_messages 
                WHERE twitch_username = ? AND stream_id = ?
            `);
            return stmt.all(twitchUsername.toLowerCase(), streamId);
        } catch (error) {
            console.error('Error getting notification messages:', error);
            return [];
        }
    }

    async deleteNotificationMessages(twitchUsername, streamId) {
        try {
            const stmt = sql.prepare(`
                DELETE FROM notification_messages 
                WHERE twitch_username = ? AND stream_id = ?
            `);
            stmt.run(twitchUsername.toLowerCase(), streamId);
            return true;
        } catch (error) {
            console.error('Error deleting notification messages:', error);
            return false;
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


}

module.exports = TwitchManager; 