const SQLite = require('better-sqlite3');
const economySQL = new SQLite('./db/economy.sqlite');

class Economy {

    constructor() {
        const table = economySQL.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'economy\';').get();
        if (!table['count(*)']) {
            // If the table isn't there, create it and setup the database correctly.
            economySQL.prepare('CREATE TABLE economy (id TEXT PRIMARY KEY, user TEXT, guild TEXT, coins INTEGER);').run();
            // Ensure that the "id" row is always unique and indexed.
            economySQL.prepare('CREATE UNIQUE INDEX idx_economy_id ON loyalty (id);').run();
            economySQL.pragma('synchronous = 1');
            economySQL.pragma('journal_mode = wal');
        }
    }

    getEconomy(user, guild) {
        return economySQL.prepare('SELECT * FROM economy WHERE user = ? AND guild = ?').get(user, guild);
    }

    setEconomy(economy) {
        return economySQL.prepare('INSERT OR REPLACE INTO loyalty (id, user, guild, coins) VALUES (@id, @user, @guild, @coins);').run(economy);
    }

    getBalance(user, guild) {
        if(guild) {
            let balance = this.getEconomy(user.id, guild.id);
            if(!balance) {
                balance = this.addUser(user, guild);
            }
            this.checkLevel(user, guild);
            return balance.coins;
        }
    }

    addUser(user, guild) {
        if (guild) {
            let economy = this.getEconomy(user.id, guild.id);
            if (!economy) {
                economy = { id: `${guild.id}-${user.id}`, user: user.id, guild: guild.id, coins: 100 };
            }

            this.setEconomy(economy);
            return economy;
        }
    }

    addCoins(coinsEarned, user, guild) {
        if(guild) {
            let economy = this.getEconomy(user.id, guild.id);
            if(!economy) {
                economy = this.addUser(user, guild);
            }

            economy.coins += coinsEarned;
            this.setEconomy(economy);
        }
    }

    deductCoins(coinsSpent, user, guild) {
        if(guild) {
            let economy = this.getEconomy(user.id, guild.id);
            if(!economy) {
                economy = this.addUser(user, guild);
            }

            economy.coins -= coinsSpent;
            this.setEconomy(economy);
        }
    }
}

module.exports = Economy;