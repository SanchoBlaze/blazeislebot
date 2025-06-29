const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/economy.sqlite');

class Economy {

    constructor(client) {
        this.client = client;
        this.setupDatabase();
    }

    setupDatabase() {
        // Create economy table if it doesn't exist
        const table = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'economy\';').get();
        if (!table['count(*)']) {
            sql.prepare(`
                CREATE TABLE economy (
                    id TEXT PRIMARY KEY,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    balance INTEGER DEFAULT 0,
                    bank INTEGER DEFAULT 0,
                    last_daily TEXT,
                    last_work TEXT,
                    total_earned INTEGER DEFAULT 0,
                    total_spent INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `).run();
            
            // Create indexes for better performance
            sql.prepare('CREATE INDEX idx_economy_user_guild ON economy (user, guild);').run();
            sql.prepare('CREATE INDEX idx_economy_balance ON economy (balance DESC);').run();
            sql.pragma('synchronous = 1');
            sql.pragma('journal_mode = wal');
        }

        // Create transactions table for history
        const transactionsTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'transactions\';').get();
        if (!transactionsTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    description TEXT,
                    target_user TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `).run();
            
            sql.prepare('CREATE INDEX idx_transactions_user_guild ON transactions (user, guild);').run();
            sql.prepare('CREATE INDEX idx_transactions_type ON transactions (type);').run();
            sql.prepare('CREATE INDEX idx_transactions_created_at ON transactions (created_at DESC);').run();
        }
    }

    // Get user's economy data
    getUser(userId, guildId) {
        let user = sql.prepare('SELECT * FROM economy WHERE user = ? AND guild = ?').get(userId, guildId);
        if (!user) {
            // Create new user if they don't exist
            user = {
                id: `${guildId}-${userId}`,
                user: userId,
                guild: guildId,
                balance: 0,
                bank: 0,
                last_daily: null,
                last_work: null,
                total_earned: 0,
                total_spent: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.createUser(user);
        }
        return user;
    }

    // Create new user
    createUser(userData) {
        return sql.prepare(`
            INSERT INTO economy (id, user, guild, balance, bank, last_daily, last_work, total_earned, total_spent, created_at, updated_at)
            VALUES (@id, @user, @guild, @balance, @bank, @last_daily, @last_work, @total_earned, @total_spent, @created_at, @updated_at)
        `).run(userData);
    }

    // Update user's balance
    updateBalance(userId, guildId, amount, type = 'balance') {
        const user = this.getUser(userId, guildId);
        const oldBalance = user[type];
        
        // Apply coin multiplier to positive amounts (earnings) if user has active effect
        let finalAmount = amount;
        if (amount > 0 && this.client && this.client.inventory) {
            const coinMultiplier = this.client.inventory.getCoinMultiplier(userId, guildId);
            if (coinMultiplier > 1) {
                const originalAmount = amount;
                finalAmount = Math.floor(amount * coinMultiplier);
                console.log(`[updateBalance] User ${userId} has coin multiplier ${coinMultiplier}x: ${originalAmount} -> ${finalAmount} coins`);
            }
        }
        
        const newBalance = Math.max(0, oldBalance + finalAmount); // Prevent negative balance
        
        sql.prepare(`
            UPDATE economy 
            SET ${type} = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user = ? AND guild = ?
        `).run(newBalance, userId, guildId);

        // Update totals (use original amount for tracking, not multiplied amount)
        if (amount > 0) {
            sql.prepare(`
                UPDATE economy 
                SET total_earned = total_earned + ?
                WHERE user = ? AND guild = ?
            `).run(amount, userId, guildId);
        } else if (amount < 0) {
            sql.prepare(`
                UPDATE economy 
                SET total_spent = total_spent + ?
                WHERE user = ? AND guild = ?
            `).run(Math.abs(amount), userId, guildId);
        }

        return newBalance;
    }

    // Transfer money between users
    async transfer(fromUserId, toUserId, guildId, amount, description = 'Transfer') {
        if (amount <= 0) throw new Error('Transfer amount must be positive');
        
        const fromUser = this.getUser(fromUserId, guildId);
        if (fromUser.balance < amount) throw new Error('Insufficient funds');

        // Use transaction to ensure data consistency
        const transaction = sql.transaction(() => {
            // Deduct from sender
            this.updateBalance(fromUserId, guildId, -amount, 'balance');
            
            // Add to receiver
            this.updateBalance(toUserId, guildId, amount, 'balance');
            
            // Log transaction
            this.logTransaction(fromUserId, guildId, 'transfer_out', -amount, description, toUserId);
            this.logTransaction(toUserId, guildId, 'transfer_in', amount, description, fromUserId);
        });

        transaction();
        return true;
    }

    // Deposit money to bank
    deposit(userId, guildId, amount) {
        if (amount <= 0) throw new Error('Deposit amount must be positive');
        
        const user = this.getUser(userId, guildId);
        if (user.balance < amount) throw new Error('Insufficient funds');

        this.updateBalance(userId, guildId, -amount, 'balance');
        this.updateBalance(userId, guildId, amount, 'bank');
        this.logTransaction(userId, guildId, 'deposit', -amount, 'Bank deposit');
        
        return this.getUser(userId, guildId);
    }

    // Withdraw money from bank
    withdraw(userId, guildId, amount) {
        if (amount <= 0) throw new Error('Withdrawal amount must be positive');
        
        const user = this.getUser(userId, guildId);
        if (user.bank < amount) throw new Error('Insufficient funds in bank');

        this.updateBalance(userId, guildId, amount, 'balance');
        this.updateBalance(userId, guildId, -amount, 'bank');
        this.logTransaction(userId, guildId, 'withdraw', amount, 'Bank withdrawal');
        
        return this.getUser(userId, guildId);
    }

    // Daily reward
    async daily(userId, guildId, amount = 100) {
        const user = this.getUser(userId, guildId);
        const now = new Date();
        const lastDaily = user.last_daily ? new Date(user.last_daily) : null;
        
        // Check if user can claim daily (24 hours)
        if (lastDaily && (now - lastDaily) < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            throw new Error(`Daily reward available in ${hours}h ${minutes}m`);
        }

        // Apply daily multiplier if user has active effect
        let finalAmount = amount;
        if (this.client && this.client.inventory) {
            if (this.client.inventory.hasDailyMultiplier(userId, guildId)) {
                const dailyMultiplier = this.client.inventory.getDailyMultiplier(userId, guildId);
                finalAmount = Math.floor(amount * dailyMultiplier);
                console.log(`[daily] User ${userId} has daily multiplier ${dailyMultiplier}x: ${amount} -> ${finalAmount} coins`);
            }
        }

        // Update last daily time and add money
        sql.prepare(`
            UPDATE economy 
            SET last_daily = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user = ? AND guild = ?
        `).run(userId, guildId);

        this.updateBalance(userId, guildId, finalAmount, 'balance');
        this.logTransaction(userId, guildId, 'daily', finalAmount, 'Daily reward');
        
        return this.getUser(userId, guildId);
    }

    // Work reward
    async work(userId, guildId) {
        const user = this.getUser(userId, guildId);
        const now = new Date();
        const lastWork = user.last_work ? new Date(user.last_work) : null;
        
        // Check if user can work (1 hour cooldown)
        if (lastWork && (now - lastWork) < 60 * 60 * 1000) {
            const timeLeft = 60 * 60 * 1000 - (now - lastWork);
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            throw new Error(`Work available in ${minutes}m ${seconds}s`);
        }

        // Random work reward between 10-50 coins
        let amount = Math.floor(Math.random() * 41) + 10;

        // Apply work multiplier if user has active effect
        if (this.client && this.client.inventory) {
            const workMultiplier = this.client.inventory.getWorkMultiplier(userId, guildId);
            if (workMultiplier > 1) {
                const originalAmount = amount;
                amount = Math.floor(amount * workMultiplier);
                console.log(`[work] User ${userId} has work multiplier ${workMultiplier}x: ${originalAmount} -> ${amount} coins`);
            }
        }

        // Update last work time and add money
        sql.prepare(`
            UPDATE economy 
            SET last_work = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user = ? AND guild = ?
        `).run(userId, guildId);

        this.updateBalance(userId, guildId, amount, 'balance');
        this.logTransaction(userId, guildId, 'work', amount, 'Work reward');
        
        return { user: this.getUser(userId, guildId), amount };
    }

    // Get leaderboard
    getLeaderboard(guildId, limit = 10) {
        return sql.prepare(`
            SELECT user, balance, bank, (balance + bank) as total
            FROM economy 
            WHERE guild = ?
            ORDER BY total DESC
            LIMIT ?
        `).all(guildId, limit);
    }

    // Get transaction history
    getTransactionHistory(userId, guildId, limit = 10) {
        return sql.prepare(`
            SELECT * FROM transactions 
            WHERE user = ? AND guild = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(userId, guildId, limit);
    }

    // Log transaction
    logTransaction(userId, guildId, type, amount, description, targetUserId = null) {
        return sql.prepare(`
            INSERT INTO transactions (user, guild, type, amount, description, target_user)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, guildId, type, amount, description, targetUserId);
    }

    // Get economy stats
    getStats(guildId) {
        const stats = sql.prepare(`
            SELECT 
                COUNT(*) as total_users,
                SUM(balance) as total_balance,
                SUM(bank) as total_bank,
                SUM(total_earned) as total_earned,
                SUM(total_spent) as total_spent,
                AVG(balance) as avg_balance,
                AVG(bank) as avg_bank
            FROM economy 
            WHERE guild = ?
        `).get(guildId);

        return {
            total_users: stats.total_users || 0,
            total_balance: stats.total_balance || 0,
            total_bank: stats.total_bank || 0,
            total_earned: stats.total_earned || 0,
            total_spent: stats.total_spent || 0,
            avg_balance: Math.round(stats.avg_balance || 0),
            avg_bank: Math.round(stats.avg_bank || 0)
        };
    }

    // Format currency
    formatCurrency(amount) {
        return `${amount.toLocaleString()} coins`;
    }

    // Check if user can afford something
    canAfford(userId, guildId, amount) {
        const user = this.getUser(userId, guildId);
        return user.balance >= amount;
    }

    // Get user's net worth (balance + bank)
    getNetWorth(userId, guildId) {
        const user = this.getUser(userId, guildId);
        return user.balance + user.bank;
    }
}

module.exports = Economy; 