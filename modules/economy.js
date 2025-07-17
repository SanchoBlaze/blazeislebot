const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/economy.sqlite');
const { EmbedBuilder } = require('discord.js');

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
                    last_fishing TEXT,
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
        } else {
            // Check if last_fishing column exists, add it if it doesn't
            try {
                sql.prepare('SELECT last_fishing FROM economy LIMIT 1').get();
            } catch (error) {
                if (error.message.includes('no such column')) {
                    console.log('Adding last_fishing column to existing economy table...');
                    sql.prepare('ALTER TABLE economy ADD COLUMN last_fishing TEXT').run();
                }
            }
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
            const nowISOString = new Date().toISOString();
            user = {
                id: `${guildId}-${userId}`,
                user: userId,
                guild: guildId,
                balance: 0,
                bank: 0,
                last_daily: null,
                last_work: null,
                last_fishing: null,
                total_earned: 0,
                total_spent: 0,
                created_at: nowISOString,
                updated_at: nowISOString
            };
            this.createUser(user);
        }
        return user;
    }

    // Create new user
    createUser(userData) {
        return sql.prepare(`
            INSERT INTO economy (id, user, guild, balance, bank, last_daily, last_work, last_fishing, total_earned, total_spent, created_at, updated_at)
            VALUES (@id, @user, @guild, @balance, @bank, @last_daily, @last_work, @last_fishing, @total_earned, @total_spent, @created_at, @updated_at)
        `).run(userData);
    }

    // Update user's balance
    async updateBalance(userId, guildId, amount, type = 'balance') {
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
        
        const nowISOString = new Date().toISOString();
        sql.prepare(`
            UPDATE economy 
            SET ${type} = ?, updated_at = ?
            WHERE user = ? AND guild = ?
        `).run(newBalance, nowISOString, userId, guildId);

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

        // --- Net Worth XP Bonus Logic ---
        // Create table if not exists
        sql.prepare(`CREATE TABLE IF NOT EXISTS net_worth_xp_bonuses (
            user TEXT NOT NULL,
            guild TEXT NOT NULL,
            threshold INTEGER NOT NULL,
            PRIMARY KEY (user, guild, threshold)
        )`).run();

        // Thresholds and XP bonuses
        const thresholds = [10000, 50000, 100000, 250000, 500000, 1000000];
        const xpBonuses = [250, 750, 1500, 3000, 6000, 12000];
        // Get current net worth
        const netWorth = this.getNetWorth(userId, guildId);
        // Get claimed bonuses
        const claimedRows = sql.prepare('SELECT threshold FROM net_worth_xp_bonuses WHERE user = ? AND guild = ?').all(userId, guildId);
        const claimed = new Set(claimedRows.map(r => r.threshold));
        for (let i = 0; i < thresholds.length; i++) {
            const threshold = thresholds[i];
            if (netWorth >= threshold && !claimed.has(threshold)) {
                // Mark as claimed
                sql.prepare('INSERT OR IGNORE INTO net_worth_xp_bonuses (user, guild, threshold) VALUES (?, ?, ?)')
                    .run(userId, guildId, threshold);
                // Always fetch userObj for notification and XP
                let userObj;
                try {
                    const member = this.client.guilds.cache.get(guildId)?.members.cache.get(userId);
                    userObj = member ? member.user : await this.client.users.fetch(userId);
                } catch (e) {
                    userObj = null;
                }
                // Grant XP
                if (this.client && this.client.loyalty && userObj) {
                    await this.client.loyalty.addXp(xpBonuses[i], userObj, this.client.guilds.cache.get(guildId));
                }
                // Notify in economy channel
                try {
                    const settings = this.client.settings.get(guildId);
                    const channelId = settings && settings.economy_channel_id;
                    if (channelId) {
                        const guild = this.client.guilds.cache.get(guildId);
                        if (guild) {
                            const channel = guild.channels.cache.get(channelId);
                            if (channel) {
                                const embed = new EmbedBuilder()
                                    .setColor(0xFFD700)
                                    .setTitle('🏆 Wealth Milestone!')
                                    .setDescription(`<@${userId}> reached a net worth of **${threshold.toLocaleString()} coins** and earned a bonus of **${xpBonuses[i].toLocaleString()} XP**!`)
                                    .setThumbnail(userObj?.displayAvatarURL ? userObj.displayAvatarURL() : null)
                                    .setTimestamp();
                                channel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error sending net worth XP bonus notification:', err);
                }
            }
        }
        // --- End Net Worth XP Bonus Logic ---

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
    async deposit(userId, guildId, amount) {
        if (amount <= 0) throw new Error('Deposit amount must be positive');
        
        const user = this.getUser(userId, guildId);
        if (user.balance < amount) throw new Error('Insufficient funds');

        await this.updateBalance(userId, guildId, -amount, 'balance');
        await this.updateBalance(userId, guildId, amount, 'bank');
        this.logTransaction(userId, guildId, 'deposit', -amount, 'Bank deposit');
        
        return this.getUser(userId, guildId);
    }

    // Withdraw money from bank
    async withdraw(userId, guildId, amount) {
        if (amount <= 0) throw new Error('Withdrawal amount must be positive');
        
        const user = this.getUser(userId, guildId);
        if (user.bank < amount) throw new Error('Insufficient funds in bank');

        await this.updateBalance(userId, guildId, amount, 'balance');
        await this.updateBalance(userId, guildId, -amount, 'bank');
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
        const nowISOString = new Date().toISOString();
        sql.prepare(`
            UPDATE economy 
            SET last_daily = ?, updated_at = ?
            WHERE user = ? AND guild = ?
        `).run(nowISOString, nowISOString, userId, guildId);

        await this.updateBalance(userId, guildId, finalAmount, 'balance');
        this.logTransaction(userId, guildId, 'daily', finalAmount, 'Daily reward');
        
        return this.getUser(userId, guildId);
    }

    // Work reward
    async work(userId, guildId, options = {}) {
        const user = this.getUser(userId, guildId);
        const now = new Date();
        const lastWork = user.last_work ? new Date(user.last_work) : null;
        console.log(`[work] User: ${userId}, Guild: ${guildId}, last_work before:`, user.last_work);
        // Check if user can work (1 hour cooldown)
        if (lastWork && (now - lastWork) < 60 * 60 * 1000) {
            const timeLeft = 60 * 60 * 1000 - (now - lastWork);
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            throw new Error(`Work available in ${minutes}m ${seconds}s`);
        }

        // Use amountOverride if provided, else randomize
        let amount;
        if (options && typeof options.amountOverride === 'number') {
            amount = Math.floor(options.amountOverride);
        } else {
            amount = Math.floor(Math.random() * 41) + 10;
        }
        // Always apply work multiplier if user has active effect
        if (this.client && this.client.inventory) {
            const workMultiplier = this.client.inventory.getWorkMultiplier(userId, guildId);
            if (workMultiplier > 1) {
                const originalAmount = amount;
                amount = Math.floor(amount * workMultiplier);
                console.log(`[work] User ${userId} has work multiplier ${workMultiplier}x: ${originalAmount} -> ${amount} coins`);
            }
        }
        // Debug logging before updating balance
        const userBeforeWork = this.getUser(userId, guildId);
        console.log(`[WORK BACKEND DEBUG] About to add amount: ${amount} to user: ${userId} (balance before: ${userBeforeWork.balance})`);
        if (amount <= 0) {
            console.warn(`[WORK BACKEND WARNING] Attempted to add non-positive amount: ${amount} for user: ${userId}`);
        }
        // Update last work time and add money
        const nowISOString = new Date().toISOString();
        sql.prepare(`
            UPDATE economy 
            SET last_work = ?, updated_at = ?
            WHERE user = ? AND guild = ?
        `).run(nowISOString, nowISOString, userId, guildId);
        const updatedUser = this.getUser(userId, guildId);
        console.log(`[work] User: ${userId}, Guild: ${guildId}, last_work after:`, updatedUser.last_work);
        try {
            await this.updateBalance(userId, guildId, amount, 'balance');
        } catch (err) {
            console.error(`[WORK BACKEND ERROR] updateBalance failed for user: ${userId}, amount: ${amount}`, err);
        }
        const userAfterWork = this.getUser(userId, guildId);
        console.log(`[WORK BACKEND DEBUG] User: ${userId} balance after work: ${userAfterWork.balance}`);

        this.logTransaction(userId, guildId, 'work', amount, 'Work reward');
        
        return { user: updatedUser, amount };
    }

    // Fishing reward
    async fish(userId, guildId) {
        const user = this.getUser(userId, guildId);
        const now = new Date();
        const lastFishing = user.last_fishing ? new Date(user.last_fishing) : null;
        
        // Get user's fishing cooldown multiplier (rods reduce cooldown)
        const cooldownMultiplier = this.client.inventory.getFishingCooldown(userId, guildId);
        const baseCooldown = 30 * 60 * 1000; // 30 minutes in milliseconds
        const actualCooldown = baseCooldown * cooldownMultiplier;
        
        // Check if user can fish (dynamic cooldown based on rod)
        if (lastFishing && (now - lastFishing) < actualCooldown) {
            const timeLeft = actualCooldown - (now - lastFishing);
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            throw new Error(`Fishing available in ${minutes}m ${seconds}s`);
        }

        // Check for mermaid event (5% chance)
        const mermaidChance = 0.05; // 5% chance
        if (Math.random() < mermaidChance) {
            // Update last fishing time even for mermaid event
            const nowISOString = new Date().toISOString();
            sql.prepare(`
                UPDATE economy 
                SET last_fishing = ?, updated_at = ?
                WHERE user = ? AND guild = ?
            `).run(nowISOString, nowISOString, userId, guildId);

            this.logTransaction(userId, guildId, 'fishing', 0, 'Encountered a mermaid');
            
            return { 
                user: this.getUser(userId, guildId), 
                mermaid: true,
                id: null
            };
        }

        // Get all fish items from the inventory system (optimized)
        const fishItems = this.client.inventory.getAllFish(guildId);
        
        if (fishItems.length === 0) {
            throw new Error('No fish available for fishing in this server. Contact an administrator to add fish items.');
        }

        // Get user's bait boost (from active effects)
        const baitBoost = this.client.inventory.getBaitBoost(userId, guildId);
        
        // Create fish types array with chances based on rarity and bait
        const fishTypes = fishItems.filter(item => {
            if (item.types && Array.isArray(item.types)) {
                return item.types.includes('fish');
            }
            return item.type === 'fish';
        }).map(item => {
            let baseChance;
            switch (item.rarity) {
                case 'common': baseChance = 35; break;
                case 'uncommon': baseChance = 30; break;
                case 'rare': baseChance = 20; break;
                case 'epic': baseChance = 10; break;
                case 'legendary': baseChance = 4; break;
                case 'mythic': baseChance = 1; break;
                default: baseChance = 10; break;
            }
            // Apply bait boost to rare+ fish only (with success rate like fertilisers)
            let finalChance = baseChance;
            if (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary' || item.rarity === 'mythic') {
                // Bait success rates (similar to fertiliser system)
                const baitSuccessRates = {
                    common: 0.8,    // 80% chance for basic bait
                    uncommon: 0.6,  // 60% chance for premium bait
                    rare: 0.4,      // 40% chance for magic bait
                    epic: 0.25,     // 25% chance for epic bait
                    legendary: 0.15, // 15% chance for legendary bait
                    mythic: 0.05    // 5% chance for mythic bait
                };
                
                // Check if bait effect is active and succeeds
                if (baitBoost > 1 && Math.random() < baitSuccessRates[item.rarity]) {
                    finalChance = baseChance * baitBoost;
                }
            }
            return {
                ...item, // Spread all properties, including emoji
                sellPrice: item.price, // Keep for compatibility
                chance: finalChance,
                baseChance: baseChance
            };
        });

        // Calculate total chance and determine which fish was caught
        const totalChance = fishTypes.reduce((sum, fish) => sum + fish.chance, 0);
        const random = Math.random() * totalChance;
        let cumulativeChance = 0;
        let caughtFish = null;

        for (const fish of fishTypes) {
            cumulativeChance += fish.chance;
            if (random <= cumulativeChance) {
                caughtFish = fish;
                break;
            }
        }

        // If no fish was caught (shouldn't happen, but just in case)
        if (!caughtFish) {
            caughtFish = fishTypes[0]; // Default to first fish
        }

        // Add the fish to user's inventory
        this.client.inventory.addItem(userId, guildId, caughtFish.id, 1);

        // Update last fishing time
        const nowISOString = new Date().toISOString();
        sql.prepare(`
            UPDATE economy 
            SET last_fishing = ?, updated_at = ?
            WHERE user = ? AND guild = ?
        `).run(nowISOString, nowISOString, userId, guildId);

        this.logTransaction(userId, guildId, 'fishing', 0, `Caught ${caughtFish.name}`);
        
        return { 
            user: this.getUser(userId, guildId), 
            fish: caughtFish,
            id: caughtFish.id
        };
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
        if (typeof amount !== 'number' || !isFinite(amount)) amount = 0;
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