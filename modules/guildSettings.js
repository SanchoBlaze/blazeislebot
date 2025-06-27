const SQLite = require('better-sqlite3');

class GuildSettings {
    constructor(client) {
        this.db = new SQLite('./db/guilds.sqlite');
        this.client = client;
        this.initDatabase();
        this.notifiedOwners = new Set(); // Track which owners we've already notified
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
                    mod_role_id TEXT,
                    welcome_channel_id TEXT
                )
            `).run();
            this.db.pragma('synchronous = 1');
            this.db.pragma('journal_mode = wal');
            console.log('Created guild_settings table.');
        } else {
            // Migration: Add welcome_channel_id column if it doesn't exist
            try {
                const columnCheck = this.db.prepare("PRAGMA table_info(guild_settings)").all();
                const hasWelcomeChannel = columnCheck.some(col => col.name === 'welcome_channel_id');
                
                if (!hasWelcomeChannel) {
                    this.db.prepare('ALTER TABLE guild_settings ADD COLUMN welcome_channel_id TEXT').run();
                    console.log('Added welcome_channel_id column to guild_settings table.');
                }
            } catch (error) {
                console.error('Error checking/adding welcome_channel_id column:', error);
            }
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
        
        const validKeys = ['rules_channel_id', 'rules_message_id', 'members_role_id', 'streams_channel_id', 'mod_role_id', 'welcome_channel_id'];
        if (!validKeys.includes(key)) {
            throw new Error(`Invalid setting key: ${key}`);
        }

        this.db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
        return this.get(guildId);
    }

    // Check if required settings are configured for a specific feature
    isConfiguredFor(guildId, feature) {
        const settings = this.get(guildId);
        
        switch (feature) {
            case 'rules':
                return !!(settings.rules_channel_id && settings.rules_message_id && settings.members_role_id);
            case 'twitch':
                return !!(settings.streams_channel_id && settings.mod_role_id);
            case 'welcome':
                return !!(settings.welcome_channel_id);
            case 'basic':
                return !!(settings.rules_channel_id && settings.rules_message_id && settings.members_role_id);
            default:
                return false;
        }
    }

    // Get missing settings for a feature
    getMissingSettings(guildId, feature) {
        const settings = this.get(guildId);
        const missing = [];
        
        switch (feature) {
            case 'rules':
                if (!settings.rules_channel_id) missing.push('Rules Channel');
                if (!settings.rules_message_id) missing.push('Rules Message ID');
                if (!settings.members_role_id) missing.push('Members Role');
                break;
            case 'twitch':
                if (!settings.streams_channel_id) missing.push('Streams Channel');
                if (!settings.mod_role_id) missing.push('Mod Role');
                break;
            case 'welcome':
                if (!settings.welcome_channel_id) missing.push('Welcome Channel');
                break;
            case 'basic':
                if (!settings.rules_channel_id) missing.push('Rules Channel');
                if (!settings.rules_message_id) missing.push('Rules Message ID');
                if (!settings.members_role_id) missing.push('Members Role');
                break;
        }
        
        return missing;
    }

    // Notify guild owner about missing configuration
    async notifyOwnerIfNeeded(guild, feature, context = '') {
        if (!guild || this.notifiedOwners.has(`${guild.id}_${feature}`)) {
            return; // Don't spam the owner
        }

        if (!this.isConfiguredFor(guild.id, feature)) {
            try {
                const owner = await guild.fetchOwner();
                const missing = this.getMissingSettings(guild.id, feature);
                
                const embed = {
                    title: '⚙️ Bot Configuration Required',
                    description: `Hi! I need some configuration to work properly in **${guild.name}**.`,
                    color: 0xFFA500, // Orange
                    fields: [
                        {
                            name: '❌ Missing Settings',
                            value: missing.map(setting => `• ${setting}`).join('\n'),
                            inline: false
                        },
                        {
                            name: '🔧 How to Fix',
                            value: `Run \`/config set\` in your server and click the buttons to configure each setting.`,
                            inline: false
                        }
                    ],
                    footer: {
                        text: context || 'This message is sent once per feature to avoid spam.'
                    },
                    timestamp: new Date().toISOString()
                };

                await owner.send({ embeds: [embed] });
                this.notifiedOwners.add(`${guild.id}_${feature}`);
                console.log(`Notified ${owner.user.tag} about missing ${feature} configuration for ${guild.name}`);
            } catch (error) {
                console.error(`Failed to notify owner of ${guild.name} about missing configuration:`, error.message);
            }
        }
    }

    // Safe getter that checks configuration and notifies owner
    async safeGet(guildId, feature = 'basic') {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;

        const settings = this.get(guildId);
        
        // Check if configured for the requested feature
        if (!this.isConfiguredFor(guildId, feature)) {
            await this.notifyOwnerIfNeeded(guild, feature);
            return null; // Return null to indicate missing configuration
        }
        
        return settings;
    }
}

module.exports = GuildSettings; 