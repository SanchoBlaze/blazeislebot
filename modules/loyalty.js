const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/loyalty.sqlite');

class Loyalty {

    constructor(client) {
        this.client = client;
        const table = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'loyalty\';').get();
        if (!table['count(*)']) {
            // If the table isn't there, create it and setup the database correctly.
            sql.prepare('CREATE TABLE loyalty (id TEXT PRIMARY KEY, user TEXT, guild TEXT, xp INTEGER, level INTEGER);').run();
            // Ensure that the "id" row is always unique and indexed.
            sql.prepare('CREATE UNIQUE INDEX idx_loyalty_id ON loyalty (id);').run();
            sql.pragma('synchronous = 1');
            sql.pragma('journal_mode = wal');
        }
    }

    // Calculate XP required for a specific level
    // Uses exponential scaling: XP = level^2.5 * 100
    // Level 1: 100 XP, Level 2: 566 XP, Level 3: 1,548 XP, Level 4: 3,200 XP, etc.
    getXpForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(Math.pow(level, 2.5) * 100);
    }

    // Calculate level from total XP
    getLevelFromXp(xp) {
        if (xp < 100) return 1;
        
        // Binary search to find the correct level
        let low = 1;
        let high = 100; // Max reasonable level
        
        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            if (this.getXpForLevel(mid) <= xp) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        
        return low;
    }

    // Get XP needed for next level
    getXpForNextLevel(currentXp, currentLevel) {
        const nextLevelXp = this.getXpForLevel(currentLevel + 1);
        return nextLevelXp - currentXp;
    }

    // Get XP progress within current level
    getXpProgress(currentXp, currentLevel) {
        const currentLevelXp = this.getXpForLevel(currentLevel);
        const nextLevelXp = this.getXpForLevel(currentLevel + 1);
        const progressXp = currentXp - currentLevelXp;
        const totalXpForLevel = nextLevelXp - currentLevelXp;
        
        return {
            current: progressXp,
            total: totalXpForLevel,
            percentage: Math.floor((progressXp / totalXpForLevel) * 100)
        };
    }

    getLoyalty(user, guild) {
        return sql.prepare('SELECT * FROM loyalty WHERE user = ? AND guild = ?').get(user, guild);
    }

    setLoyalty(loyalty) {
        return sql.prepare('INSERT OR REPLACE INTO loyalty (id, user, guild, xp, level) VALUES (@id, @user, @guild, @xp, @level);').run(loyalty);
    }

    getLeaders(guild) {
        return sql.prepare('SELECT * FROM loyalty WHERE guild = ? ORDER BY xp DESC LIMIT 10;').all(guild.id);
    }

    addUser(user, guild) {
        if (guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if (!loyalty) {
                loyalty = { id: `${guild.id}-${user.id}`, user: user.id, guild: guild.id, xp: 0, level: 1 };
            }

            this.setLoyalty(loyalty);
            return loyalty;
        }
    }

    async addXp(xpEarned, user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }

            const oldLevel = loyalty.level;
            loyalty.xp += xpEarned;
            
            // Calculate new level based on total XP
            const newLevel = this.getLevelFromXp(loyalty.xp);
            
            if (newLevel > oldLevel) {
                loyalty.level = newLevel;
                this.setLoyalty(loyalty);
                await this.handleLevelUp(user, guild, oldLevel, newLevel);
            } else {
                this.setLoyalty(loyalty);
            }
        }
    }

    async handleLevelUp(user, guild, oldLevel, newLevel) {
        // Get configured welcome channel or fallback to general
        const settings = await this.client.settings.safeGet(guild.id, 'welcome');
        let channel = null;
        
        if (settings && settings.welcome_channel_id) {
            channel = guild.channels.cache.get(settings.welcome_channel_id);
        }
        
        // Fallback to general channel if welcome channel not configured
        if (!channel) {
            channel = guild.channels.cache.find(ch => ch.name === 'general');
        }
        
        if (channel) {
            const levelsGained = newLevel - oldLevel;
            
            if (levelsGained === 1) {
                // Single level up
                channel.send(`🎉 ${user} leveled up to level **${newLevel}**! Congratulations!`);
            } else {
                // Multiple levels gained
                channel.send(`🚀 ${user} gained **${levelsGained} levels** and is now level **${newLevel}**! Amazing! 🎉`);
            }
        }
    }

    getXp(user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            return loyalty.xp;
        }
    }

    getLevel(user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            return loyalty.level;
        }
    }

    // Legacy method for backward compatibility - now just updates level based on XP
    async checkLevel(user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            
            const correctLevel = this.getLevelFromXp(loyalty.xp);
            if (loyalty.level !== correctLevel) {
                const oldLevel = loyalty.level;
                loyalty.level = correctLevel;
                this.setLoyalty(loyalty);
                
                if (correctLevel > oldLevel) {
                    await this.handleLevelUp(user, guild, oldLevel, correctLevel);
                }
            }
        }
    }

}

module.exports = Loyalty;