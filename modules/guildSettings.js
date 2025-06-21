const SQLite = require('better-sqlite3');

class GuildSettings {
    constructor(client) {
        this.db = new SQLite('./db/guilds.sqlite');
        this.client = client;
        this.initDatabase();
    }

    initDatabase() {
        const table = this.db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'guild_settings';").get();
        if (!table['count(*)']) {
            this.db.prepare(`
                CREATE TABLE guild_settings (
                    guild_id TEXT PRIMARY KEY,
                    rules_channel_id TEXT,
                    rules_message_id TEXT,
                    members_role_id TEXT,
                    streams_channel_id TEXT,
                    mod_role_id TEXT
                )
            `).run();
            this.db.pragma('synchronous = 1');
            this.db.pragma('journal_mode = wal');
            console.log('Created guild_settings table.');
        }
    }

    get(guildId) {
        let settings = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        if (!settings) {
            this.db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
            settings = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        }
        return settings;
    }

    set(guildId, key, value) {
        // Ensure the guild exists
        this.get(guildId);
        
        const validKeys = ['rules_channel_id', 'rules_message_id', 'members_role_id', 'streams_channel_id', 'mod_role_id'];
        if (!validKeys.includes(key)) {
            throw new Error(`Invalid setting key: ${key}`);
        }

        this.db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
        return this.get(guildId);
    }
}

module.exports = GuildSettings; 