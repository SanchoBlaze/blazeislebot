const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/loyalty.sqlite');

class Loyalty {

    constructor() {
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

    addXp(xpEarned, user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }

            loyalty.xp += xpEarned;
            this.setLoyalty(loyalty);
        }

    }

    getXp(user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            this.checkLevel(user, guild);
            return loyalty.xp;
        }
    }

    getLevel(user, guild) {
        if(guild) {
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            this.checkLevel(user, guild);
            return loyalty.level;
        }
    }

    checkLevel(user, guild) {
        if(guild) {
            const channel = guild.channels.cache.find(ch => ch.name === 'general');
            let loyalty = this.getLoyalty(user.id, guild.id);
            if(!loyalty) {
                loyalty = this.addUser(user, guild);
            }
            const curLevel = Math.floor(0.1 * Math.sqrt(loyalty.xp));

            if (loyalty.level < curLevel) {
                loyalty.level++;
                this.setLoyalty(loyalty);
                channel.send(`${user} leveled up to level **${curLevel}**! Congratulations 🎉`);
            }
        }
    }

}

module.exports = Loyalty;