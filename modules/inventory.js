const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/inventory.sqlite');
const emojiConfigs = require('../config/emoji-configs.json');
const config = require('../config/default.json');
const path = require('path');
const fs = require('fs');

class Inventory {

    constructor(client) {
        this.client = client;
        this.setupDatabase();
    }

    setupDatabase() {
        // Create inventory table if it doesn't exist
        const table = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'inventory\';').get();
        if (!table['count(*)']) {
            sql.prepare(`
                CREATE TABLE inventory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    expires_at TEXT,
                    UNIQUE(user, guild, item_id)
                );
            `).run();
            
            // Create indexes for better performance
            sql.prepare('CREATE INDEX idx_inventory_user_guild ON inventory (user, guild);').run();
            sql.prepare('CREATE INDEX idx_inventory_item ON inventory (item_id);').run();
            sql.prepare('CREATE INDEX idx_inventory_expires ON inventory (expires_at);').run();
            sql.pragma('synchronous = 1');
            sql.pragma('journal_mode = wal');
        }

        // Add 'variant' column to inventory if missing
        const pragma = sql.prepare("PRAGMA table_info(inventory);").all();
        const hasVariant = pragma.some(col => col.name === 'variant');
        if (!hasVariant) {
            sql.prepare('ALTER TABLE inventory ADD COLUMN variant TEXT;').run();
        }

        // Add unique index for (user, guild, item_id, variant) if missing
        sql.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_guild_item_variant
            ON inventory (user, guild, item_id, variant)
        `).run();

        // Create items table for item definitions
        const itemsTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'items\';').get();
        if (!itemsTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    guild TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    rarity TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    max_quantity INTEGER NOT NULL DEFAULT 1,
                    duration_hours INTEGER NOT NULL DEFAULT 0,
                    effect_type TEXT,
                    effect_value INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    emoji TEXT
                )
            `).run();
            
            sql.prepare('CREATE INDEX idx_items_guild ON items (guild);').run();
            sql.prepare('CREATE INDEX idx_items_type ON items (type);').run();
            sql.prepare('CREATE INDEX idx_items_rarity ON items (rarity);').run();
        }

        // Create active_effects table for tracking active item effects
        const effectsTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'active_effects\';').get();
        if (!effectsTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE IF NOT EXISTS active_effects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    effect_type TEXT NOT NULL,
                    effect_value INTEGER NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user, guild, effect_type)
                )
            `).run();
            
            sql.prepare('CREATE INDEX idx_active_effects_user_guild ON active_effects (user, guild);').run();
            sql.prepare('CREATE INDEX idx_active_effects_type ON active_effects (effect_type);').run();
            sql.prepare('CREATE INDEX idx_active_effects_expires ON active_effects (expires_at);').run();
        }
    }

    // Populate default items for a specific guild
    populateDefaultItems(guildId) {
        // Load default items from JSON file
        const defaultItems = require('../data/default-items.json');
        
        // Determine which emoji set to use based on environment
        const emojiSet = config.Enviroment.live 
            ? emojiConfigs['production_bot'] 
            : emojiConfigs['test_bot'] || emojiConfigs['default'];

        // Insert default items for the specific guild with emoji overrides
        for (const item of defaultItems) {
            // Use emoji from config if available, otherwise use the default emoji
            const emoji = emojiSet[item.id] || item.emoji;
            
            sql.prepare(`
                INSERT OR IGNORE INTO items (id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, emoji)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                item.id, guildId, item.name, item.description, item.type, item.rarity, 
                item.price, item.max_quantity, item.duration_hours, item.effect_type, 
                item.effect_value, emoji
            );
        }
    }

    // Get item definition
    getItem(itemId, guildId) {
        return sql.prepare('SELECT * FROM items WHERE id = ? AND guild = ?').get(itemId, guildId);
    }

    // Get all items for a guild
    getAllItems(guildId) {
        return sql.prepare('SELECT * FROM items WHERE guild = ? ORDER BY price ASC').all(guildId);
    }

    // Get items by type for a guild (supports items with a 'types' array)
    getItemsByType(type, guildId) {
        return this.getAllItems(guildId).filter(item => {
            if (item.types && Array.isArray(item.types)) {
                return item.types.includes(type);
            }
            return item.type === type;
        });
    }

    // Get all fish items for a guild (supports 'types' array)
    getAllFish(guildId) {
        return this.getAllItems(guildId).filter(item => {
            if (item.types && Array.isArray(item.types)) {
                return item.types.includes('fish');
            }
            return item.type === 'fish';
        }).sort((a, b) => {
            // Sort by rarity ASC, price ASC
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const aRarity = rarityOrder.indexOf(a.rarity);
            const bRarity = rarityOrder.indexOf(b.rarity);
            if (aRarity !== bRarity) return aRarity - bRarity;
            return a.price - b.price;
        });
    }

    // Get user's inventory
    getUserInventory(userId, guildId) {
        return sql.prepare(`
            SELECT i.*, inv.quantity, inv.acquired_at, inv.expires_at, inv.variant
            FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user = ? AND inv.guild = ?
            ORDER BY i.rarity DESC, i.name ASC
        `).all(userId, guildId);
    }

    // Add item to user's inventory
    async addItem(userId, guildId, itemId, quantity = 1, interaction = null, client = null, variant = null) {
        console.log(`[addItem] Called for user ${userId} in guild ${guildId} for item ${itemId} (quantity: ${quantity}, variant: ${variant})`);
        const item = this.getItem(itemId, guildId);
        if (!item) throw new Error('Item not found');

        const nowISOString = new Date().toISOString();
        const expiresAt = item.duration_hours > 0 
            ? new Date(Date.now() + item.duration_hours * 60 * 60 * 1000).toISOString()
            : null;

        // Enforce max_quantity
        const userItem = this.getUserItem(userId, guildId, itemId);
        const currentQty = userItem ? userItem.quantity : 0;
        const maxQty = item.max_quantity || 1;
        let toAdd = quantity;
        let capped = false;
        const notify = async (msg) => {
            if (interaction) {
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: msg, flags: 64 });
                    } else {
                        await interaction.reply({ content: msg, flags: 64 });
                    }
                } catch {}
            } else if (client) {
                try {
                    const user = await client.users.fetch(userId);
                    if (user) await user.send(msg);
                } catch {}
            } else {
                console.log('[addItem notify]', msg);
            }
        };
        if (currentQty >= maxQty) {
            console.log(`[addItem] User ${userId} already at or above max_quantity (${maxQty}) for item ${itemId}`);
            notify(`You are already at the maximum quantity (${maxQty}) for **${item.name}**!`);
            return { success: false, added: 0, capped: true, newQuantity: currentQty };
        }
        if (currentQty + quantity > maxQty) {
            toAdd = maxQty - currentQty;
            capped = true;
            console.log(`[addItem] User ${userId} hit max_quantity cap for item ${itemId}: only adding ${toAdd}`);
            notify(`You can only add ${toAdd} more of **${item.name}** (max ${maxQty}).`);
        }
        if (toAdd <= 0) {
            return { success: false, added: 0, capped: true, newQuantity: currentQty };
        }

        try {
            sql.prepare(`
                INSERT INTO inventory (user, guild, item_id, quantity, expires_at, acquired_at, variant)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user, guild, item_id, variant) 
                DO UPDATE SET 
                    quantity = quantity + ?,
                    expires_at = CASE 
                        WHEN ? IS NOT NULL THEN ?
                        ELSE expires_at 
                    END
            `).run(userId, guildId, itemId, toAdd, expiresAt, nowISOString, variant, toAdd, expiresAt, expiresAt);
            // After updating or inserting, log the new quantity
            const updatedItem = this.getUserItem(userId, guildId, itemId);
            if (updatedItem) {
                console.log(`[addItem] After operation: user ${userId} now has ${updatedItem.quantity} of item ${itemId}`);
            }
            // Legendary notification logic
            if (item.rarity === 'legendary' && toAdd > 0 && this.client && this.client.settings) {
                try {
                    const settings = this.client.settings.get(guildId);
                    const channelId = settings && settings.economy_channel_id;
                    if (channelId) {
                        const guild = this.client.guilds.cache.get(guildId);
                        if (guild) {
                            const channel = guild.channels.cache.get(channelId);
                            if (channel) {
                                const user = await this.client.users.fetch(userId);
                                const { EmbedBuilder } = require('discord.js');
                                const emoji = this.getItemEmoji(item);
                                const embed = new EmbedBuilder()
                                    .setColor(this.getRarityColour('legendary'))
                                    .setTitle('🏆 Legendary Item Acquired!')
                                    .setDescription(`${user} just received a legendary item: **${emoji} ${item.name}**!`)
                                    .setThumbnail(this.getEmojiUrl(emoji, this.client))
                                    .setTimestamp();
                                channel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error sending legendary item notification:', err);
                }
            }
            return { success: true, added: toAdd, capped, newQuantity: updatedItem ? updatedItem.quantity : 0 };
        } catch (error) {
            console.error('Error adding item to inventory:', error);
            return { success: false, added: 0, capped, newQuantity: currentQty };
        }
    }

    // Remove item from user's inventory
    removeItem(userId, guildId, itemId, quantity = 1) {
        const current = sql.prepare('SELECT quantity FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').get(userId, guildId, itemId);
        
        if (!current) throw new Error('Item not in inventory');
        if (current.quantity < quantity) throw new Error('Not enough items');

        if (current.quantity === quantity) {
            sql.prepare('DELETE FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').run(userId, guildId, itemId);
        } else {
            sql.prepare('UPDATE inventory SET quantity = quantity - ? WHERE user = ? AND guild = ? AND item_id = ?').run(quantity, userId, guildId, itemId);
        }
        
        return true;
    }

    // Use/consume an item
    async useItem(userId, guildId, itemId) {
        const item = this.getItem(itemId, guildId);
        if (!item) throw new Error('Item not found');

        const inventoryItem = sql.prepare('SELECT * FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').get(userId, guildId, itemId);
        if (!inventoryItem) throw new Error('Item not in inventory');

        // Check if item is expired
        if (inventoryItem.expires_at && new Date(inventoryItem.expires_at) < new Date()) {
            this.removeItem(userId, guildId, itemId, inventoryItem.quantity);
            throw new Error('Item has expired');
        }

        // Check for existing effects of the same type
        if (item.effect_type && ['xp_multiplier', 'work_multiplier', 'daily_multiplier', 'coin_multiplier'].includes(item.effect_type)) {
            const existingEffect = this.getActiveEffect(userId, guildId, item.effect_type);
            if (existingEffect) {
                const effectTypeName = {
                    'xp_multiplier': 'XP boost',
                    'work_multiplier': 'work boost',
                    'daily_multiplier': 'daily multiplier',
                    'coin_multiplier': 'coin multiplier'
                }[item.effect_type];
                
                throw new Error(`You already have an active ${effectTypeName}! Wait for it to expire before using another.`);
            }
        }

        // Process item effect
        let result = { success: true, message: '', effect: null };

        switch (item.effect_type) {
            case 'xp_multiplier':
                this.addActiveEffect(userId, guildId, 'xp_multiplier', item.effect_value, item.duration_hours);
                result.effect = { type: 'xp_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `XP boost activated! You'll get ${item.effect_value}x XP for ${item.duration_hours} hour(s).`;
                break;
                
            case 'work_multiplier':
                this.addActiveEffect(userId, guildId, 'work_multiplier', item.effect_value, item.duration_hours);
                result.effect = { type: 'work_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `Work boost activated! You'll get ${item.effect_value}x coins from work for ${item.duration_hours} hour(s).`;
                break;
                
            case 'daily_multiplier':
                this.addActiveEffect(userId, guildId, 'daily_multiplier', item.effect_value, item.duration_hours);
                result.effect = { type: 'daily_multiplier', value: item.effect_value };
                result.message = `Daily boost activated!  ${item.effect_value}x coins from daily rewards for ${item.duration_hours} hour(s).`;
                break;

            case 'coin_multiplier':
                this.addActiveEffect(userId, guildId, 'coin_multiplier', item.effect_value, item.duration_hours);
                result.effect = { type: 'coin_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `Coin multiplier activated! You'll get ${item.effect_value}x coins from all sources for ${item.duration_hours} hour(s).`;
                break;
                
            case 'random_item':
                result = await this.openMysteryBox(userId, guildId);
                break;

            case 'rare_random_item':
                result = await this.openRareMysteryBox(userId, guildId);
                break;

            case 'scratch_card': {
                // 50% nothing, 30% coins, 20% item (weighted by rarity)
                const roll = Math.random();
                if (roll < 0.5) {
                    result.message = '😢 You scratched and found nothing. Better luck next time!';
                } else if (roll < 0.8) {
                    // 30% coins
                    const coins = Math.floor(Math.random() * 901) + 100;
                    if (this.client && this.client.economy) {
                        this.client.economy.updateBalance(userId, guildId, coins, 'balance');
                        this.client.economy.logTransaction(userId, guildId, 'scratch_card_win', coins, 'Scratch Card Win');
                    }
                    result.effect = { type: 'coins', amount: coins };
                    result.message = `🎉 You scratched and won **${coins} coins**!`;
                } else {
                    // 20% item (weighted by rarity)
                    const allItems = this.getAllItems(guildId).filter(i => i.type !== 'mystery' && i.id !== 'scratch_card');
                    // Rarity weights: common 40, uncommon 30, rare 15, epic 10, legendary 5
                    const rarityWeights = { common: 40, uncommon: 30, rare: 15, epic: 10, legendary: 5 };
                    let weightedPool = [];
                    for (const item of allItems) {
                        const weight = rarityWeights[item.rarity] || 1;
                        for (let i = 0; i < weight; i++) {
                            weightedPool.push(item);
                        }
                    }
                    if (weightedPool.length > 0) {
                        const randomItem = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                        this.addItem(userId, guildId, randomItem.id, 1);
                        result.effect = { type: 'item', item: randomItem };
                        result.message = `🎁 You scratched and won a **${randomItem.name}**!`;
                    } else {
                        result.message = 'You scratched, but there was nothing to win this time.';
                    }
                }
                break;
            }
                
            case 'random_message': {
                // Pool of possible messages
                const messages = [
                    "You unroll the note: 'The sea whispers secrets to those who listen.'",
                    "The message reads: 'Luck comes to the patient angler.'",
                    "You find a riddle: 'What has a head and a tail but no body? (A coin!)'",
                    "The bottle contains a map... or is it just a doodle?",
                    "You read: 'A friend is thinking of you right now.'",
                    "The note says: 'You will catch something rare soon.'",
                    "A cryptic message: 'Beware the old boot.'",
                    "You find a coupon for one free smile. Redeem anytime!",
                    "The message is waterlogged and unreadable, but you feel lucky!",
                    "You find a poem: 'Rivers run deep, secrets they keep.'"
                ];
                const random = Math.floor(Math.random() * messages.length);
                result.message = messages[random];
                result.effect = { type: 'random_message' };
                break;
            }

            case 'random_effect': {
                // Define possible random effects with their probabilities
                const effects = [
                    // 25% chance - XP boost (1-3 hours, 2-3x multiplier)
                    { 
                        type: 'xp_boost', 
                        weight: 25, 
                        message: (duration, multiplier) => `🌟 **XP Boost!** You gain ${multiplier}x XP for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'xp_multiplier', multiplier, duration);
                            return { type: 'xp_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 3) + 1, multiplier: Math.floor(Math.random() * 2) + 2 })
                    },
                    // 20% chance - Work boost (1-2 hours, 2-4x multiplier)
                    { 
                        type: 'work_boost', 
                        weight: 20, 
                        message: (duration, multiplier) => `💼 **Work Boost!** You earn ${multiplier}x coins from work for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'work_multiplier', multiplier, duration);
                            return { type: 'work_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 2) + 1, multiplier: Math.floor(Math.random() * 3) + 2 })
                    },
                    // 15% chance - Coin boost (1-2 hours, 2-3x multiplier)
                    { 
                        type: 'coin_boost', 
                        weight: 15, 
                        message: (duration, multiplier) => `💰 **Coin Boost!** You earn ${multiplier}x coins from all sources for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'coin_multiplier', multiplier, duration);
                            return { type: 'coin_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 2) + 1, multiplier: Math.floor(Math.random() * 2) + 2 })
                    },
                    // 15% chance - Instant coins (500-2000)
                    { 
                        type: 'instant_coins', 
                        weight: 15, 
                        message: (amount) => `💸 **Instant Wealth!** You receive ${amount} coins!`,
                        action: (amount) => {
                            if (this.client && this.client.economy) {
                                this.client.economy.updateBalance(userId, guildId, amount, 'balance');
                                this.client.economy.logTransaction(userId, guildId, 'golden_apple_coins', amount, 'Golden Apple Coins');
                            }
                            return { type: 'coins', amount: amount };
                        },
                        getParams: () => ({ amount: Math.floor(Math.random() * 1501) + 500 })
                    },
                    // 10% chance - Random item (weighted by rarity)
                    { 
                        type: 'random_item', 
                        weight: 10, 
                        message: (itemName) => `🎁 **Magical Gift!** You receive a ${itemName}!`,
                        action: (itemName) => {
                            const allItems = this.getAllItems(guildId).filter(i => i.type !== 'mystery' && i.id !== 'crop_golden_apple');
                            const rarityWeights = { common: 30, uncommon: 25, rare: 20, epic: 15, legendary: 10 };
                            let weightedPool = [];
                            for (const item of allItems) {
                                const weight = rarityWeights[item.rarity] || 1;
                                for (let i = 0; i < weight; i++) {
                                    weightedPool.push(item);
                                }
                            }
                            if (weightedPool.length > 0) {
                                const randomItem = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                                this.addItem(userId, guildId, randomItem.id, 1);
                                return { type: 'item', item: randomItem };
                            }
                            return { type: 'item', item: null };
                        },
                        getParams: () => ({ itemName: 'random item' })
                    },
                    // 8% chance - Daily multiplier (24 hours, 2-3x)
                    { 
                        type: 'daily_multiplier', 
                        weight: 8, 
                        message: (multiplier) => `📅 **Daily Boost!** Your next daily reward will be ${multiplier}x for 24 hours!`,
                        action: (multiplier) => {
                            this.addActiveEffect(userId, guildId, 'daily_multiplier', multiplier, 24);
                            return { type: 'daily_multiplier', value: multiplier, duration: 24 };
                        },
                        getParams: () => ({ multiplier: Math.floor(Math.random() * 2) + 2 })
                    },
                    // 7% chance - Nothing (but funny message)
                    { 
                        type: 'nothing', 
                        weight: 7, 
                        message: () => {
                            const messages = [
                                `🍎 **Golden Apple Effect:** You feel... different. But also the same. The apple was delicious though!`,
                                `🍎 **Golden Apple Effect:** The apple was so golden it blinded you temporarily. You're fine now, but still confused.`,
                                `🍎 **Golden Apple Effect:** You ate the apple and now you're wondering if it was actually just a regular apple painted gold.`,
                                `🍎 **Golden Apple Effect:** The apple disappears in a puff of golden smoke. At least it smelled nice!`,
                                `🍎 **Golden Apple Effect:** You feel a brief surge of power... and then it's gone. Was that supposed to happen?`,
                                `🍎 **Golden Apple Effect:** The apple was apparently just a very convincing prop. You've been tricked by a master illusionist!`,
                                `🍎 **Golden Apple Effect:** You gain the power of... nothing. The apple was a dud, but it tasted amazing!`,
                                `🍎 **Golden Apple Effect:** The golden apple grants you the wisdom of the ancients. Unfortunately, you forgot it immediately.`
                            ];
                            return messages[Math.floor(Math.random() * messages.length)];
                        },
                        action: () => null,
                        getParams: () => ({})
                    }
                ];

                // Create weighted pool
                let weightedPool = [];
                for (const effect of effects) {
                    for (let i = 0; i < effect.weight; i++) {
                        weightedPool.push(effect);
                    }
                }

                // Select random effect
                const selectedEffect = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                const params = selectedEffect.getParams();
                
                // Execute the effect
                const effectResult = selectedEffect.action(...Object.values(params));
                result.effect = effectResult;
                result.message = selectedEffect.message(...Object.values(params));
                break;
            }

            case 'crystal_random_effect': {
                // Define possible crystal berry effects with better probabilities and values
                const effects = [
                    // 30% chance - XP boost (2-5 hours, 3-5x multiplier) - BETTER
                    { 
                        type: 'xp_boost', 
                        weight: 30, 
                        message: (duration, multiplier) => `💎 **Crystal XP Boost!** You gain ${multiplier}x XP for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'xp_multiplier', multiplier, duration);
                            return { type: 'xp_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 4) + 2, multiplier: Math.floor(Math.random() * 3) + 3 })
                    },
                    // 25% chance - Work boost (2-4 hours, 3-6x multiplier) - BETTER
                    { 
                        type: 'work_boost', 
                        weight: 25, 
                        message: (duration, multiplier) => `💎 **Crystal Work Boost!** You earn ${multiplier}x coins from work for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'work_multiplier', multiplier, duration);
                            return { type: 'work_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 3) + 2, multiplier: Math.floor(Math.random() * 4) + 3 })
                    },
                    // 20% chance - Coin boost (2-4 hours, 3-5x multiplier) - BETTER
                    { 
                        type: 'coin_boost', 
                        weight: 20, 
                        message: (duration, multiplier) => `💎 **Crystal Coin Boost!** You earn ${multiplier}x coins from all sources for ${duration} hour(s)!`,
                        action: (duration, multiplier) => {
                            this.addActiveEffect(userId, guildId, 'coin_multiplier', multiplier, duration);
                            return { type: 'coin_multiplier', value: multiplier, duration: duration };
                        },
                        getParams: () => ({ duration: Math.floor(Math.random() * 3) + 2, multiplier: Math.floor(Math.random() * 3) + 3 })
                    },
                    // 15% chance - Instant coins (1000-3000) - BETTER
                    { 
                        type: 'instant_coins', 
                        weight: 15, 
                        message: (amount) => `💎 **Crystal Wealth!** You receive ${amount} coins!`,
                        action: (amount) => {
                            if (this.client && this.client.economy) {
                                this.client.economy.updateBalance(userId, guildId, amount, 'balance');
                                this.client.economy.logTransaction(userId, guildId, 'crystal_berry_coins', amount, 'Crystal Berry Coins');
                            }
                            return { type: 'coins', amount: amount };
                        },
                        getParams: () => ({ amount: Math.floor(Math.random() * 2001) + 1000 })
                    },
                    // 8% chance - Rare+ item (better rarity weights) - BETTER
                    { 
                        type: 'rare_item', 
                        weight: 8, 
                        message: (itemName) => `💎 **Crystal Gift!** You receive a ${itemName}!`,
                        action: (itemName) => {
                            const allItems = this.getAllItems(guildId).filter(i => i.type !== 'mystery' && i.id !== 'crop_crystal_berry' && i.id !== 'crop_golden_apple');
                            // Better rarity weights: rare 40, epic 35, legendary 25
                            const rarityWeights = { rare: 40, epic: 35, legendary: 25 };
                            let weightedPool = [];
                            for (const item of allItems) {
                                const weight = rarityWeights[item.rarity] || 0;
                                for (let i = 0; i < weight; i++) {
                                    weightedPool.push(item);
                                }
                            }
                            if (weightedPool.length > 0) {
                                const randomItem = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                                this.addItem(userId, guildId, randomItem.id, 1);
                                return { type: 'item', item: randomItem };
                            }
                            return { type: 'item', item: null };
                        },
                        getParams: () => ({ itemName: 'rare item' })
                    },
                    // 2% chance - Nothing (but funny message)
                    { 
                        type: 'nothing', 
                        weight: 2, 
                        message: () => {
                            const messages = [
                                `💎 **Crystal Berry Effect:** The berry dissolves into pure light, leaving you feeling... enlightened? Or maybe just confused.`,
                                `💎 **Crystal Berry Effect:** The crystal shatters into a thousand tiny stars that fade into nothingness. At least it was pretty!`,
                                `💎 **Crystal Berry Effect:** You feel a brief moment of cosmic clarity... then it's gone. What was that about?`,
                                `💎 **Crystal Berry Effect:** The berry turns to dust in your hands. On the bright side, you now have magical dust! (It's just regular dust)`,
                                `💎 **Crystal Berry Effect:** The crystal berry was actually just a very convincing piece of glass. You've been bamboozled!`,
                                `💎 **Crystal Berry Effect:** The berry disappears with a tiny 'pop' sound. You're not sure if that was supposed to happen.`,
                                `💎 **Crystal Berry Effect:** The berry's magic was in the journey, not the destination. Or maybe it was just defective.`,
                                `💎 **Crystal Berry Effect:** Sometimes the greatest magic is the friends we made along the way. But you didn't make any friends.`
                            ];
                            return messages[Math.floor(Math.random() * messages.length)];
                        },
                        action: () => null,
                        getParams: () => ({})
                    }
                ];

                // Create weighted pool
                let weightedPool = [];
                for (const effect of effects) {
                    for (let i = 0; i < effect.weight; i++) {
                        weightedPool.push(effect);
                    }
                }

                // Select random effect
                const selectedEffect = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                const params = selectedEffect.getParams();
                
                // Execute the effect
                const effectResult = selectedEffect.action(...Object.values(params));
                result.effect = effectResult;
                result.message = selectedEffect.message(...Object.values(params));
                break;
            }
                
            default:
                result.message = `Used ${item.name}.`;
        }

        // Remove item if it's consumable
        const isConsumable = (item.type === 'consumable') || (item.types && Array.isArray(item.types) && item.types.includes('consumable'));
        if (isConsumable || item.type === 'mystery') {
            this.removeItem(userId, guildId, itemId, 1);
        }

        return result;
    }

    // Open mystery box
    async openMysteryBox(userId, guildId, interaction = null, client = null) {
        const allItems = this.getAllItems(guildId).filter(item => item.type !== 'mystery');
        const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
        
        if (randomItem) {
            this.addItem(userId, guildId, randomItem.id, 1, interaction, client);
            return {
                success: true,
                message: `🎉 You found **${randomItem.name}** in the mystery box!`,
                effect: { type: 'item_received', item: randomItem }
            };
        }
        
        return {
            success: true,
            message: 'The mystery box was empty...',
            effect: null
        };
    }

    // Open rare mystery box
    async openRareMysteryBox(userId, guildId, interaction = null, client = null) {
        const allItems = this.getAllItems(guildId).filter(item => 
            item.type !== 'mystery' && 
            (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary')
        );
        
        if (allItems.length === 0) {
            // Fallback to regular items if no rare+ items exist
            const fallbackItems = this.getAllItems(guildId).filter(item => item.type !== 'mystery');
            const randomItem = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
            
            if (randomItem) {
                this.addItem(userId, guildId, randomItem.id, 1, interaction, client);
                return {
                    success: true,
                    message: `🎉 You found **${randomItem.name}** in the premium mystery box!`,
                    effect: { type: 'item_received', item: randomItem }
                };
            }
        } else {
            const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
            this.addItem(userId, guildId, randomItem.id, 1, interaction, client);
            return {
                success: true,
                message: `🎉 You found **${randomItem.name}** in the premium mystery box!`,
                effect: { type: 'item_received', item: randomItem }
            };
        }
        
        return {
            success: true,
            message: 'The rare mystery box was empty...',
            effect: null
        };
    }

    // Check if user has item
    hasItem(userId, guildId, itemId) {
        const item = sql.prepare('SELECT * FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').get(userId, guildId, itemId);
        if (!item) return false;
        
        // Check if expired
        if (item.expires_at && new Date(item.expires_at) < new Date()) {
            this.removeItem(userId, guildId, itemId, item.quantity);
            return false;
        }
        
        return true;
    }

    // Get item count
    getItemCount(userId, guildId, itemId) {
        const item = sql.prepare('SELECT quantity FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').get(userId, guildId, itemId);
        return item ? item.quantity : 0;
    }

    // Clean up expired items
    cleanupExpiredItems() {
        const expired = sql.prepare("SELECT * FROM inventory WHERE expires_at IS NOT NULL AND strftime('%s', expires_at) < strftime('%s', 'now')").all();
        
        for (const item of expired) {
            this.removeItem(item.user, item.guild, item.item_id, item.quantity);
        }
        
        return expired.length;
    }

    // Get rarity colour
    getRarityColour(rarity) {
        const colours = {
            common: 0xFFFFFF,      // White
            uncommon: 0x00FF00,    // Green
            rare: 0x0099FF,        // Blue
            epic: 0x9932CC,        // Purple
            legendary: 0xFFD700    // Gold
        };
        return colours[rarity] || colours.common;
    }

    // Get rarity emoji
    getRarityEmoji(rarity) {
        const emojis = {
            common: '⚪',
            uncommon: '🟢',
            rare: '🔵',
            epic: '🟣',
            legendary: '🟡'
        };
        return emojis[rarity] || emojis.common;
    }

    // Get custom emoji for an item, fallback to rarity emoji
    getItemEmoji(item) {
        return (item.emoji != null && item.emoji !== "") ? item.emoji : this.getRarityEmoji(item.rarity);
    }

    // Get emoji URL for thumbnail (supports custom Discord emojis and Unicode emojis only)
    getEmojiUrl(emoji, client) {
        // If it's a custom Discord emoji (format: <:name:id>)
        if (emoji && emoji.startsWith('<') && emoji.endsWith('>')) {
            const emojiId = emoji.match(/:(\d+)>/)?.[1];
            if (emojiId) {
                return `https://cdn.discordapp.com/emojis/${emojiId}.png`;
            }
        }
        // For Unicode emojis, use Twemoji CDN (handle all code points, use PNG for compatibility)
        if (emoji && emoji.length > 0) {
            const codePoints = Array.from(emoji)
                .map(char => char.codePointAt(0).toString(16))
                .join('-');
            return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints}.png`;
        }
        return null;
    }

    // Add item to shop
    addShopItem(itemData) {
        try {
            const {
                id, guild, name, description, type, rarity, price,
                max_quantity = 1, duration_hours = 0, effect_type = null,
                effect_value = null
            } = itemData;

            sql.prepare(`
                INSERT OR REPLACE INTO items (id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value);

            return true;
        } catch (error) {
            console.error('Error adding shop item:', error);
            return false;
        }
    }

    // Admin: Remove item from shop
    removeShopItem(itemId, guildId) {
        try {
            const result = sql.prepare('DELETE FROM items WHERE id = ? AND guild = ?').run(itemId, guildId);
            return result.changes > 0;
        } catch (error) {
            console.error('Error removing shop item:', error);
            return false;
        }
    }

    // Admin: Get all shop items for a guild
    getShopItems(guildId) {
        return sql.prepare('SELECT * FROM items WHERE guild = ? ORDER BY price ASC').all(guildId);
    }

    // Admin: Check if item exists in a guild
    itemExists(itemId, guildId) {
        const item = sql.prepare('SELECT id FROM items WHERE id = ? AND guild = ?').get(itemId, guildId);
        return !!item;
    }

    // Get sell price percentage based on rarity
    getSellPricePercentage(rarity, itemType = null) {
        // Fish always sell for full price (100%)
        if (itemType === 'fish') {
            return 1.0;
        }
        
        switch (rarity) {
            case 'common': return 0.4;    // 40% of original price
            case 'uncommon': return 0.5;  // 50% of original price
            case 'rare': return 0.6;      // 60% of original price
            case 'epic': return 0.7;      // 70% of original price
            case 'legendary': return 0.8; // 80% of original price
            default: return 0.4;          // Default 40%
        }
    }

    // Sell an item back to the shop
    sellItem(userId, guildId, itemId, quantity = 1) {
        // Get item details
        const item = this.getItem(itemId, guildId);
        if (!item) {
            return { success: false, message: 'Item not found in shop.' };
        }

        // Check if user has the item
        const userItem = this.getUserItem(userId, guildId, itemId);
        if (!userItem || userItem.quantity < quantity) {
            const availableQty = userItem ? userItem.quantity : 0;
            return { success: false, message: `You don't have enough ${item.name} to sell. You have ${availableQty}x but tried to sell ${quantity}x.` };
        }

        // Calculate sell price based on rarity and item type
        const sellPercentage = this.getSellPricePercentage(item.rarity, item.type);
        const sellPrice = Math.floor(item.price * sellPercentage) * quantity;

        // Remove item from inventory
        const newQuantity = userItem.quantity - quantity;
        if (newQuantity <= 0) {
            // Delete the item if quantity becomes 0
            sql.prepare('DELETE FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').run(userId, guildId, itemId);
        } else {
            // Update quantity
            sql.prepare('UPDATE inventory SET quantity = ? WHERE user = ? AND guild = ? AND item_id = ?').run(newQuantity, userId, guildId, itemId);
        }

        return {
            success: true,
            message: `Sold ${quantity}x ${item.name} for ${sellPrice} coins.`,
            sellPrice: sellPrice,
            item: item,
            quantity: quantity,
            sellPercentage: sellPercentage
        };
    }

    getUserItem(userId, guildId, itemId) {
        const row = sql.prepare(
            'SELECT * FROM inventory WHERE user = ? AND guild = ? AND item_id = ?'
        ).get(userId, guildId, itemId);
        return row || null;
    }

    // Add active effect
    addActiveEffect(userId, guildId, effectType, effectValue, durationHours) {
        const nowISOString = new Date().toISOString();
        const expiresAt = durationHours > 0 
            ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default 24 hours for effects without duration

        try {
            sql.prepare(`
                INSERT INTO active_effects (user, guild, effect_type, effect_value, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, guildId, effectType, effectValue, expiresAt, nowISOString);
            
            return true;
        } catch (error) {
            console.error('Error adding active effect:', error);
            return false;
        }
    }

    // Get active effect for a user
    getActiveEffect(userId, guildId, effectType) {
        const effect = sql.prepare(`
            SELECT * FROM active_effects 
            WHERE user = ? AND guild = ? AND effect_type = ? AND strftime('%s', expires_at) > strftime('%s', 'now')
        `).get(userId, guildId, effectType);
        
        return effect || null;
    }

    // Clean up expired effects
    cleanupExpiredEffects(userId = null, guildId = null) {
        try {
            let deleteQuery = "DELETE FROM active_effects WHERE strftime('%s', expires_at) <= strftime('%s', 'now')";
            let params = [];
            if (userId && guildId) {
                deleteQuery += ' AND user = ? AND guild = ?';
                params = [userId, guildId];
            }
            const result = sql.prepare(deleteQuery).run(...params);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired effects:', error);
            return 0;
        }
    }

    // Get all active effects for a user
    getActiveEffects(userId, guildId) {
        this.cleanupExpiredEffects(userId, guildId);
        return sql.prepare(`
            SELECT * FROM active_effects 
            WHERE user = ? AND guild = ? AND strftime('%s', expires_at) > strftime('%s', 'now')
            ORDER BY created_at ASC
        `).all(userId, guildId);
    }

    // Remove active effect
    removeActiveEffect(userId, guildId, effectType) {
        try {
            const result = sql.prepare(`
                DELETE FROM active_effects 
                WHERE user = ? AND guild = ? AND effect_type = ?
            `).run(userId, guildId, effectType);
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error removing active effect:', error);
            return false;
        }
    }

    // Get work multiplier for a user
    getWorkMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'work_multiplier');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Get XP multiplier for a user
    getXPMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'xp_multiplier');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Get coin multiplier for a user
    getCoinMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'coin_multiplier');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Check if user has daily multiplier
    hasDailyMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'daily_multiplier');
        if (!effect) return false;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return false;
        return true;
    }

    // Get daily multiplier for a user
    getDailyMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'daily_multiplier');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Remove daily multiplier after use
    removeDailyMultiplier(userId, guildId) {
        return this.removeActiveEffect(userId, guildId, 'daily_multiplier');
    }

    // Get user's best fishing rod
    getBestFishingRod(userId, guildId) {
        const userInventory = this.getUserInventory(userId, guildId);
        const fishingRods = userInventory.filter(item => item.type === 'fishing_rod');
        
        if (fishingRods.length === 0) return null;
        
        // Return the rod with the highest effect value (best rod)
        return fishingRods.reduce((best, current) => 
            current.effect_value > best.effect_value ? current : best
        );
    }

    // Get fishing boost multiplier for a user
    getFishingBoost(userId, guildId) {
        const bestRod = this.getBestFishingRod(userId, guildId);
        return bestRod ? bestRod.effect_value : 1;
    }

    // Get all shop items for a guild, excluding certain types (SQL filtering)
    getShopItemsExcludingTypes(guildId, excludedTypes = []) {
        if (!excludedTypes.length) {
            return this.getShopItems(guildId);
        }
        // Build SQL placeholders for excluded types
        const placeholders = excludedTypes.map(() => '?').join(', ');
        return sql.prepare(
            `SELECT * FROM items WHERE guild = ? AND type NOT IN (${placeholders}) ORDER BY price ASC`
        ).all(guildId, ...excludedTypes);
    }

    // Delete all items for a guild
    deleteAllItemsForGuild(guildId) {
        try {
            const result = sql.prepare('DELETE FROM items WHERE guild = ?').run(guildId);
            return result.changes;
        } catch (error) {
            console.error('Error deleting all items for guild:', error);
            return 0;
        }
    }

    // Delete only default items for a guild (by id)
    deleteDefaultItemsForGuild(guildId, defaultItemIds) {
        try {
            const placeholders = defaultItemIds.map(() => '?').join(', ');
            const result = sql.prepare(`DELETE FROM items WHERE guild = ? AND id IN (${placeholders})`).run(guildId, ...defaultItemIds);
            return result.changes;
        } catch (error) {
            console.error('Error deleting default items for guild:', error);
            return 0;
        }
    }

    // Get display name for an item, using variant if present
    getDisplayName(item, variant) {
        if (item.variants && Array.isArray(item.variants) && variant) {
            const found = item.variants.find(v => v.id === variant);
            if (found && found.name) return found.name;
        }
        return item.name;
    }

    // Get display emoji for an item, using variant if present
    getDisplayEmoji(item, variant) {
        // Determine which emoji set to use based on environment
        const emojiSet = config.Enviroment.live 
            ? emojiConfigs['production_bot'] 
            : emojiConfigs['test_bot'] || emojiConfigs['default'];
        if (item.variants && Array.isArray(item.variants) && variant) {
            const found = item.variants.find(v => v.id === variant);
            if (found) {
                // Try emoji config first using the format: itemId_variantId
                const variantKey = `${item.id}_${variant}`;
                if (emojiSet[variantKey]) return emojiSet[variantKey];
                if (found.emoji) return found.emoji;
            }
        }
        // Try emoji config for item id
        if (emojiSet[item.id]) return emojiSet[item.id];
        return item.emoji;
    }

    // Add this method to the Inventory class
    getItemFromConfig(itemId) {
        if (!this._itemConfigCache) {
            const configPath = path.join(__dirname, '../data/default-items.json');
            const raw = fs.readFileSync(configPath, 'utf8');
            this._itemConfigCache = JSON.parse(raw);
        }
        return this._itemConfigCache.find(item => item.id === itemId) || null;
    }
}

module.exports = Inventory;