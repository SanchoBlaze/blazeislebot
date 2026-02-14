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
        // Check if we need to migrate the inventory table structure
        const table = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'inventory\';').get();
        if (table['count(*)']) {
            // Table exists, check if it has conflicting indexes
            const indexes = sql.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory';").all();
            const hasConflictingIndex = indexes.some(idx => idx.name === 'sqlite_autoindex_inventory_1');
            
            if (hasConflictingIndex) {
                console.log('[Inventory] Detected conflicting unique index, migrating inventory table...');
                
                // Backup existing data
                const oldData = sql.prepare('SELECT * FROM inventory').all();
                console.log(`[Inventory] Backing up ${oldData.length} inventory records`);
                
                // Create new table with correct structure
                sql.prepare('DROP TABLE inventory').run();
                sql.prepare(`
                    CREATE TABLE inventory (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user TEXT NOT NULL,
                        guild TEXT NOT NULL,
                        item_id TEXT NOT NULL,
                        quantity INTEGER DEFAULT 1,
                        variant TEXT
                    );
                `).run();
                
                // Restore data (without variants for now)
                for (const record of oldData) {
                    sql.prepare(`
                        INSERT INTO inventory (user, guild, item_id, quantity, variant)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        record.user, record.guild, record.item_id, record.quantity, null
                    );
                }
                
                console.log(`[Inventory] Successfully migrated ${oldData.length} records`);
            }
        } else {
            // Create new table
            sql.prepare(`
                CREATE TABLE inventory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    variant TEXT
                );
            `).run();
        }
        
        // Create indexes for better performance
        sql.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_user_guild ON inventory (user, guild);').run();
        sql.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory (item_id);').run();
        // Create the correct unique index for (user, guild, item_id, variant)
        sql.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_guild_item_variant
            ON inventory (user, guild, item_id, variant)
        `).run();
        
        sql.pragma('synchronous = 1');
        sql.pragma('journal_mode = wal');

        // Create items table for item definitions
        const itemsTable = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'items\';').get();
        if (!itemsTable['count(*)']) {
            sql.prepare(`
                CREATE TABLE items (
                    id TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    rarity TEXT DEFAULT 'common',
                    price INTEGER DEFAULT 0,
                    max_quantity INTEGER DEFAULT 1,
                    duration_hours INTEGER DEFAULT 0,
                    effect_type TEXT,
                    effect_value INTEGER DEFAULT 0,
                    emoji TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, guild)
                );
            `).run();
            
            // Create indexes for items table
            sql.prepare('CREATE INDEX idx_items_guild ON items (guild);').run();
            sql.prepare('CREATE INDEX idx_items_type ON items (type);').run();
            sql.prepare('CREATE INDEX idx_items_rarity ON items (rarity);').run();
        }

        // Add variants column to items table if missing
        const itemsPragma = sql.prepare("PRAGMA table_info(items);").all();
        const itemsHasVariants = itemsPragma.some(col => col.name === 'variants');
        if (!itemsHasVariants) {
            sql.prepare('ALTER TABLE items ADD COLUMN variants TEXT;').run();
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

        // MIGRATION: Remove acquired_at and expires_at, dedupe inventory
        const pragma = sql.prepare("PRAGMA table_info(inventory);").all();
        const hasAcquiredAt = pragma.some(col => col.name === 'acquired_at');
        const hasExpiresAt = pragma.some(col => col.name === 'expires_at');
        if (hasAcquiredAt || hasExpiresAt) {
            console.log('[Inventory] Migrating inventory table: removing acquired_at and expires_at, deduplicating...');
            // 1. Create new table
            sql.prepare(`
                CREATE TABLE IF NOT EXISTS inventory_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user TEXT NOT NULL,
                    guild TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    variant TEXT
                );
            `).run();
            // 2. Copy deduped data
            const deduped = sql.prepare(`
                SELECT user, guild, item_id, variant, SUM(quantity) as quantity
                FROM inventory
                GROUP BY user, guild, item_id, variant
            `).all();
            const insert = sql.prepare(`
                INSERT INTO inventory_new (user, guild, item_id, quantity, variant)
                VALUES (?, ?, ?, ?, ?)
            `);
            for (const row of deduped) {
                insert.run(row.user, row.guild, row.item_id, row.quantity, row.variant);
            }
            // 3. Drop old table
            sql.prepare('DROP TABLE inventory').run();
            // 4. Rename new table
            sql.prepare('ALTER TABLE inventory_new RENAME TO inventory').run();
            // 5. Recreate indexes and unique constraint
            sql.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_user_guild ON inventory (user, guild);').run();
            sql.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory (item_id);').run();
            sql.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_guild_item_variant ON inventory (user, guild, item_id, variant);').run();
            console.log(`[Inventory] Migration complete: removed acquired_at and expires_at, deduped to ${deduped.length} rows.`);
        }
    }

    // Populate default items for a specific guild (including variants)
    populateDefaultItems(guildId) {
        // Load fresh from disk (bypass require cache so update-defaults picks up JSON changes)
        delete require.cache[require.resolve('../data/default-items.json')];
        const defaultItems = require('../data/default-items.json');
        
        // Determine which emoji set to use based on environment
        const emojiSet = config.Enviroment.live 
            ? emojiConfigs['default'] 
            : emojiConfigs['test_bot'] || emojiConfigs['default'];

        // Insert complete default items for the specific guild with emoji overrides
        for (const item of defaultItems) {
            // Use emoji from config if available, otherwise use the default emoji
            const emoji = emojiSet[item.id] || item.emoji;
            
            this.storeCompleteItem({
                ...item,
                guild: guildId,
                emoji: emoji
            });
        }
    }

    // Parse types/variants from DB row (stored as JSON strings)
    _parseItemRow(row) {
        if (!row) return row;
        if (typeof row.types === 'string') {
            try { row.types = JSON.parse(row.types); } catch (e) { row.types = null; }
        }
        if (typeof row.variants === 'string') {
            try { row.variants = JSON.parse(row.variants); } catch (e) { row.variants = null; }
        }
        return row;
    }

    // Get item definition
    getItem(itemId, guildId) {
        const row = sql.prepare('SELECT * FROM items WHERE id = ? AND guild = ?').get(itemId, guildId);
        return this._parseItemRow(row);
    }

    // Get all items for a guild
    getAllItems(guildId) {
        const rows = sql.prepare('SELECT * FROM items WHERE guild = ? ORDER BY price ASC').all(guildId);
        return rows.map(row => this._parseItemRow(row));
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
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
            const aRarity = rarityOrder.indexOf(a.rarity);
            const bRarity = rarityOrder.indexOf(b.rarity);
            if (aRarity !== bRarity) return aRarity - bRarity;
            return a.price - b.price;
        });
    }

    // Get user's inventory
    getUserInventory(userId, guildId) {
        return sql.prepare(`
            SELECT i.*, inv.quantity, inv.variant
            FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user = ? AND inv.guild = ?
            ORDER BY i.rarity DESC, i.name ASC
        `).all(userId, guildId);
    }

    // Refactor addItem to handle variants and remove addItemWithVariants
    async addItem(userId, guildId, itemId, quantity = 1, interaction = null, client = null, variant = null, variantQuantities = null) {
        console.log(`[addItem] Called for user ${userId} in guild ${guildId} for item ${itemId} (quantity: ${quantity}, variant: ${variant}, variantQuantities: ${JSON.stringify(variantQuantities)})`);
        const item = this.getItem(itemId, guildId);
        if (!item) throw new Error('Item not found');

        const nowISOString = new Date().toISOString();
        const expiresAt = item.duration_hours > 0 
            ? new Date(Date.now() + item.duration_hours * 60 * 60 * 1000).toISOString()
            : null;

        // Enforce max_quantity
        const userItem = this.getUserItem(userId, guildId, itemId);
        let currentVariants = {};
        let currentQty = 0;
        if (userItem) {
            currentQty = userItem.quantity;
            if (userItem.variants) {
                try {
                    currentVariants = JSON.parse(userItem.variants);
                } catch (e) {
                    currentVariants = {};
                }
            }
        }
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

        // Handle variantQuantities (for crops with variants)
        if (variantQuantities && typeof variantQuantities === 'object') {
            let totalAdded = 0;
            for (const [v, q] of Object.entries(variantQuantities)) {
                const safeVariant = v == null ? 'no_variant' : v;
                const currentVariantQty = this.getUserItemVariant(userId, guildId, itemId, safeVariant)?.quantity || 0;
                const newVariantQty = currentVariantQty + q;
                
                if (newVariantQty > maxQty) {
                    const excess = newVariantQty - maxQty;
                    notify(`You can only have ${maxQty} of **${item.name}** total (would exceed by ${excess}).`);
                    return { success: false, added: 0, capped: true, newQuantity: currentQty };
                }
                
                // Insert or update this specific variant
                sql.prepare(`
                    INSERT INTO inventory (user, guild, item_id, quantity, variant)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user, guild, item_id, variant) 
                    DO UPDATE SET 
                        quantity = ?
                `).run(userId, guildId, itemId, newVariantQty, safeVariant, newVariantQty);
                
                totalAdded += q;
            }
            
            const updatedItem = this.getUserItem(userId, guildId, itemId);
            if (updatedItem) {
                console.log(`[addItem] After operation: user ${userId} now has variants for item ${itemId}:`, variantQuantities);
            }
            
            // Legendary/mythic notification logic
            if ((item.rarity === 'legendary' || item.rarity === 'mythic') && totalAdded > 0 && this.client && this.client.settings) {
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
                                const rarity = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
                                const embed = new EmbedBuilder()
                                    .setColor(this.getRarityColour(item.rarity))
                                    .setTitle(item.rarity === 'mythic' ? '🌈 Mythic Item Acquired!' : '🏆 Legendary Item Acquired!')
                                    .setDescription(`${user} just received a **${rarity}** item: **${emoji} ${item.name}**!`)
                                    .setThumbnail(this.getEmojiUrl(emoji, this.client))
                                    .setTimestamp();
                                channel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch (err) {
                    // Handle errors silently or log as needed
                }
            }
            return { success: true, added: totalAdded, capped, newQuantity: updatedItem ? updatedItem.quantity : 0 };
        }

        // Handle single variant (for single-variant crops)
        if (variant) {
            const safeVariant = variant == null ? 'no_variant' : variant;
            const currentVariantQty = this.getUserItemVariant(userId, guildId, itemId, safeVariant)?.quantity || 0;
            const newVariantQty = currentVariantQty + toAdd;
            
            if (newVariantQty > maxQty) {
                const excess = newVariantQty - maxQty;
                notify(`You can only have ${maxQty} of **${item.name}** total (would exceed by ${excess}).`);
                return { success: false, added: 0, capped: true, newQuantity: currentQty };
            }
            
            sql.prepare(`
                INSERT INTO inventory (user, guild, item_id, quantity, variant)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user, guild, item_id, variant) 
                DO UPDATE SET 
                    quantity = ?
            `).run(userId, guildId, itemId, newVariantQty, safeVariant, newVariantQty);
            
            const updatedItem = this.getUserItem(userId, guildId, itemId);
            if (updatedItem) {
                console.log(`[addItem] After operation: user ${userId} now has ${newVariantQty} of item ${itemId} variant ${safeVariant}`);
            }
            
            // Legendary/mythic notification logic
            if ((item.rarity === 'legendary' || item.rarity === 'mythic') && toAdd > 0 && this.client && this.client.settings) {
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
                                const rarity = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
                                const embed = new EmbedBuilder()
                                    .setColor(this.getRarityColour(item.rarity))
                                    .setTitle(item.rarity === 'mythic' ? '🌈 Mythic Item Acquired!' : '🏆 Legendary Item Acquired!')
                                    .setDescription(`${user} just received a **${rarity}** item: **${emoji} ${item.name}**!`)
                                    .setThumbnail(this.getEmojiUrl(emoji, this.client))
                                    .setTimestamp();
                                channel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch (err) {
                    // Handle errors silently or log as needed
                }
            }
            return { success: true, added: toAdd, capped, newQuantity: updatedItem ? updatedItem.quantity : 0 };
        }

        // No variants: regular add
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
                INSERT INTO inventory (user, guild, item_id, quantity, variant)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user, guild, item_id, variant) 
                DO UPDATE SET 
                    quantity = quantity + ?
            `).run(userId, guildId, itemId, toAdd, 'no_variant', toAdd);
            const updatedItem = this.getUserItem(userId, guildId, itemId);
            if (updatedItem) {
                console.log(`[addItem] After operation: user ${userId} now has ${updatedItem.quantity} of item ${itemId}`);
            }
            // Legendary/mythic notification logic (unchanged)
            if ((item.rarity === 'legendary' || item.rarity === 'mythic') && toAdd > 0 && this.client && this.client.settings) {
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
                                const rarity = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
                                const embed = new EmbedBuilder()
                                    .setColor(this.getRarityColour(item.rarity))
                                    .setTitle(item.rarity === 'mythic' ? '🌈 Mythic Item Acquired!' : '🏆 Legendary Item Acquired!')
                                    .setDescription(`${user} just received a **${rarity}** item: **${emoji} ${item.name}**!`)
                                    .setThumbnail(this.getEmojiUrl(emoji, this.client))
                                    .setTimestamp();
                                channel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch (err) {
                    // Handle errors silently or log as needed
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

        // Check for existing effects of the same type
        if (item.effect_type && ['xp_multiplier', 'work_multiplier', 'daily_multiplier', 'coin_multiplier', 'health_boost', 'luck_boost'].includes(item.effect_type)) {
            const existingEffect = this.getActiveEffect(userId, guildId, item.effect_type);
            if (existingEffect) {
                const effectTypeName = {
                    'xp_multiplier': 'XP boost',
                    'work_multiplier': 'work boost',
                    'daily_multiplier': 'daily multiplier',
                    'coin_multiplier': 'coin multiplier',
                    'health_boost': 'health boost',
                    'luck_boost': 'luck boost'
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

            case 'fishing_boost':
                this.addActiveEffect(userId, guildId, 'fishing_boost', item.effect_value, item.duration_hours);
                result.effect = { type: 'fishing_boost', value: item.effect_value, duration: item.duration_hours };
                result.message = `🎣 Fishing bait activated! You'll get ${item.effect_value}x rare fish boost for ${item.duration_hours} hour(s).`;
                break;

            case 'health_boost':
                this.addActiveEffect(userId, guildId, 'health_boost', item.effect_value, item.duration_hours);
                result.effect = { type: 'health_boost', value: item.effect_value, duration: item.duration_hours };
                result.message = `❤️ Health boost activated! Your work mini-game time limits are increased by ${item.effect_value}x for ${item.duration_hours} hour(s).`;
                break;

            case 'luck_boost':
                this.addActiveEffect(userId, guildId, 'luck_boost', item.effect_value, item.duration_hours);
                result.effect = { type: 'luck_boost', value: item.effect_value, duration: item.duration_hours };
                result.message = `🍀 Luck boost activated! All RNG elements are improved by ${item.effect_value}x for ${item.duration_hours} hour(s).`;
                break;
                
            case 'random_item':
                result = await this.openMysteryBox(userId, guildId);
                break;

            case 'rare_random_item':
                result = await this.openRareMysteryBox(userId, guildId);
                break;

            case 'scratch_card': {
                // Apply luck boost to improve scratch card outcomes
                const luckBoost = this.getLuckBoost(userId, guildId);
                let nothingChance = 0.5;
                let coinsChance = 0.3;
                let itemChance = 0.2;
                
                if (luckBoost > 1) {
                    // With luck boost, shift probability towards better outcomes
                    const luckImprovement = (luckBoost - 1) * 0.4; // 40% of the boost value
                    nothingChance = Math.max(0.2, nothingChance - luckImprovement);
                    coinsChance = Math.min(0.5, coinsChance + luckImprovement * 0.6);
                    itemChance = Math.min(0.4, itemChance + luckImprovement * 0.4);
                }
                
                const roll = Math.random();
                if (roll < nothingChance) {
                    result.message = '😢 You scratched and found nothing. Better luck next time!';
                } else if (roll < nothingChance + coinsChance) {
                    // Coins (improved range with luck boost)
                    let minCoins = 100;
                    let maxCoins = 1000;
                    if (luckBoost > 1) {
                        const coinIncrease = Math.floor((maxCoins - minCoins) * (luckBoost - 1) * 0.5);
                        minCoins = Math.max(100, minCoins + coinIncrease);
                        maxCoins = Math.min(2000, maxCoins + coinIncrease);
                    }
                    const coins = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;
                    if (this.client && this.client.economy) {
                        this.client.economy.updateBalance(userId, guildId, coins, 'balance');
                        this.client.economy.logTransaction(userId, guildId, 'scratch_card_win', coins, 'Scratch Card Win');
                    }
                    result.effect = { type: 'coins', amount: coins };
                    result.message = `🎉 You scratched and won **${coins} coins**!${luckBoost > 1 ? ' 🍀 Luck was on your side!' : ''}`;
                } else {
                    // Item (improved rarity with luck boost)
                    const allItems = this.getAllItems(guildId).filter(i => i.type !== 'mystery' && i.id !== 'scratch_card');
                    let selectedItem = allItems[Math.floor(Math.random() * allItems.length)];
                    
                    if (luckBoost > 1) {
                        // With luck boost, improve the rarity distribution of items
                        const baseWeights = { common: 40, uncommon: 30, rare: 15, epic: 10, legendary: 5, mythic: 2 };
                        const weightedItems = [];
                        
                        for (const item of allItems) {
                            const baseWeight = baseWeights[item.rarity] || 1;
                            // Luck boost reduces common item weight and increases rare item weight
                            let finalWeight = baseWeight;
                            if (item.rarity === 'common') {
                                finalWeight = Math.floor(baseWeight * (2 - luckBoost)); // Reduce common items
                            } else if (item.rarity === 'uncommon') {
                                finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.2)); // Slight increase
                            } else if (item.rarity === 'rare') {
                                finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.5)); // Moderate increase
                            } else if (item.rarity === 'epic') {
                                finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.8)); // Good increase
                            } else if (item.rarity === 'legendary') {
                                finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 1.2)); // Strong increase
                            } else if (item.rarity === 'mythic') {
                                finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 1.5)); // Best increase
                            }
                            
                            for (let i = 0; i < Math.max(1, finalWeight); i++) {
                                weightedItems.push(item);
                            }
                        }
                        
                        if (weightedItems.length > 0) {
                            selectedItem = weightedItems[Math.floor(Math.random() * weightedItems.length)];
                        }
                    }
                    
                    if (selectedItem) {
                        this.addItem(userId, guildId, selectedItem.id, 1);
                        result.effect = { type: 'item', item: selectedItem };
                        result.message = `🎁 You scratched and won a **${selectedItem.name}**!${luckBoost > 1 ? ' 🍀 Luck was on your side!' : ''}`;
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
                            const rarityWeights = { common: 30, uncommon: 25, rare: 20, epic: 15, legendary: 10, mythic: 5 };
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
                            // Better rarity weights: rare 40, epic 35, legendary 20, mythic 5
                            const rarityWeights = { rare: 40, epic: 35, legendary: 20, mythic: 5 };
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

        // Remove item if it's consumable (including food with effects)
        const isConsumable = (item.type === 'consumable') || (item.type === 'food') || (item.types && Array.isArray(item.types) && (item.types.includes('consumable') || item.types.includes('food')));
        if (isConsumable || item.type === 'mystery') {
            this.removeItem(userId, guildId, itemId, 1);
        }

        return result;
    }

    // Open mystery box
    async openMysteryBox(userId, guildId, interaction = null, client = null) {
        const allItems = this.getAllItems(guildId).filter(item => item.type !== 'mystery');
        
        // Apply luck boost to improve item rarity chances
        let selectedItem = allItems[Math.floor(Math.random() * allItems.length)];
        const luckBoost = this.getLuckBoost(userId, guildId);
        
        if (luckBoost > 1) {
            // With luck boost, improve the rarity distribution of items
            const baseWeights = { common: 40, uncommon: 30, rare: 15, epic: 10, legendary: 5, mythic: 2 };
            const weightedItems = [];
            
            for (const item of allItems) {
                const baseWeight = baseWeights[item.rarity] || 1;
                // Luck boost reduces common item weight and increases rare item weight
                let finalWeight = baseWeight;
                if (item.rarity === 'common') {
                    finalWeight = Math.floor(baseWeight * (2 - luckBoost)); // Reduce common items
                } else if (item.rarity === 'uncommon') {
                    finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.2)); // Slight increase
                } else if (item.rarity === 'rare') {
                    finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.5)); // Moderate increase
                } else if (item.rarity === 'epic') {
                    finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 0.8)); // Good increase
                } else if (item.rarity === 'legendary') {
                    finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 1.2)); // Strong increase
                } else if (item.rarity === 'mythic') {
                    finalWeight = Math.floor(baseWeight * (1 + (luckBoost - 1) * 1.5)); // Best increase
                }
                
                for (let i = 0; i < Math.max(1, finalWeight); i++) {
                    weightedItems.push(item);
                }
            }
            
            if (weightedItems.length > 0) {
                selectedItem = weightedItems[Math.floor(Math.random() * weightedItems.length)];
            }
        }
        
        if (selectedItem) {
            this.addItem(userId, guildId, selectedItem.id, 1, interaction, client);
            return {
                success: true,
                message: `🎉 You found **${selectedItem.name}** in the mystery box!${luckBoost > 1 ? ' 🍀 Luck was on your side!' : ''}`,
                effect: { type: 'item_received', item: selectedItem }
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
            (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary' || item.rarity === 'mythic')
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
        
        return true;
    }

    // Get item count
    getItemCount(userId, guildId, itemId) {
        const row = sql.prepare('SELECT SUM(quantity) as total FROM inventory WHERE user = ? AND guild = ? AND item_id = ?').get(userId, guildId, itemId);
        return row && row.total ? row.total : 0;
    }

    // Get rarity colour
    getRarityColour(rarity) {
        const colours = {
            mythic: 0xFF00FF,      // Magenta
            legendary: 0xFFD700,  // Gold
            epic: 0x9932CC,       // Purple
            rare: 0x0099FF,       // Blue
            uncommon: 0x00FF00,   // Green
            common: 0xFFFFFF      // White
        };
        return colours[rarity] || colours.common;
    }

    // Get rarity emoji
    getRarityEmoji(rarity) {
        const emojis = {
            mythic: '🌈',
            legendary: '🟡',
            epic: '🟣',
            rare: '🔵',
            uncommon: '🟢',
            common: '⚪'
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
            case 'mythic': return 0.9;    // 90% of original price
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

    getUserItemVariant(userId, guildId, itemId, variant) {
        const safeVariant = variant == null ? 'no_variant' : variant;
        const row = sql.prepare(
            'SELECT * FROM inventory WHERE user = ? AND guild = ? AND item_id = ? AND variant = ?'
        ).get(userId, guildId, itemId, safeVariant);
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

    // Get user's best fishing rod (for cooldown reduction)
    getBestFishingRod(userId, guildId) {
        const userInventory = this.getUserInventory(userId, guildId);
        const fishingRods = userInventory.filter(item => item.type === 'fishing_rod');
        
        if (fishingRods.length === 0) return null;
        
        // Return the rod with the lowest effect value (best cooldown reduction)
        return fishingRods.reduce((best, current) => 
            current.effect_value < best.effect_value ? current : best
        );
    }

    // Get fishing cooldown multiplier for a user (lower = faster)
    getFishingCooldown(userId, guildId) {
        const bestRod = this.getBestFishingRod(userId, guildId);
        return bestRod ? bestRod.effect_value : 1;
    }

    // Get user's best cooking tool (for cooldown reduction and recipe unlock tier)
    getBestCookingTool(userId, guildId) {
        const userInventory = this.getUserInventory(userId, guildId);
        const cookingTools = userInventory.filter(item => item.type === 'cooking_tool');
        if (cookingTools.length === 0) return null;
        return cookingTools.reduce((best, current) =>
            current.effect_value < best.effect_value ? current : best
        );
    }

    // Get cooking cooldown multiplier for a user (lower = faster)
    getCookingCooldown(userId, guildId) {
        const bestTool = this.getBestCookingTool(userId, guildId);
        return bestTool ? bestTool.effect_value : 1;
    }

    // Get health boost multiplier for a user (from active effects)
    getHealthBoost(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'health_boost');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Check if user has health boost
    hasHealthBoost(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'health_boost');
        if (!effect) return false;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return false;
        return true;
    }

    // Get luck boost multiplier for a user (from active effects)
    getLuckBoost(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'luck_boost');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Check if user has luck boost
    hasLuckBoost(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'luck_boost');
        if (!effect) return false;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return false;
        return true;
    }

    // Get bait boost multiplier for a user (from active effects)
    getBaitBoost(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'fishing_boost');
        if (!effect) return 1;
        if (effect.expires_at && new Date(effect.expires_at) < new Date()) return 1;
        return effect.effect_value;
    }

    // Get fishing boost multiplier for a user (legacy method for compatibility)
    getFishingBoost(userId, guildId) {
        return this.getBaitBoost(userId, guildId);
    }

    // Get user's best watering can
    getBestWateringCan(userId, guildId) {
        const userInventory = this.getUserInventory(userId, guildId);
        const wateringCans = userInventory.filter(item => item.type === 'watering_can');
        if (wateringCans.length === 0) return null;
        // Return the can with the lowest effect_value (fastest growth)
        return wateringCans.reduce((best, current) =>
            current.effect_value < best.effect_value ? current : best
        );
    }

    // Get watering boost multiplier for a user (default 1 if none)
    getWateringBoost(userId, guildId) {
        const bestCan = this.getBestWateringCan(userId, guildId);
        return bestCan ? bestCan.effect_value : 1;
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
            ? emojiConfigs['default'] 
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

    // Get variant quantities for an item
    getItemVariants(userId, guildId, itemId) {
        const variants = sql.prepare(`
            SELECT variant, quantity 
            FROM inventory 
            WHERE user = ? AND guild = ? AND item_id = ?
        `).all(userId, guildId, itemId);
        
        const result = {};
        for (const row of variants) {
            const variantKey = row.variant === 'no_variant' ? null : row.variant;
            result[variantKey] = row.quantity;
        }
        
        return result;
    }

    // Remove specific variant quantities
    async removeItemVariants(userId, guildId, itemId, variantQuantities) {
        let totalRemoved = 0;

        for (const [variant, quantity] of Object.entries(variantQuantities)) {
            const safeVariant = variant == null ? 'no_variant' : variant;
            const existing = this.getUserItemVariant(userId, guildId, itemId, safeVariant);
            
            if (!existing) continue;

            const toRemove = Math.min(existing.quantity, quantity);
            const newQuantity = existing.quantity - toRemove;
            totalRemoved += toRemove;

            if (newQuantity <= 0) {
                // Remove this variant entirely
                sql.prepare(`
                    DELETE FROM inventory 
                    WHERE user = ? AND guild = ? AND item_id = ? AND variant = ?
                `).run(userId, guildId, itemId, safeVariant);
            } else {
                // Update quantity for this variant
                sql.prepare(`
                    UPDATE inventory 
                    SET quantity = ?
                    WHERE user = ? AND guild = ? AND item_id = ? AND variant = ?
                `).run(newQuantity, userId, guildId, itemId, safeVariant);
            }
        }

        return { success: true, removed: totalRemoved };
    }

    // Store complete item definition in database (including variants). Only main type is stored, not types array.
    storeCompleteItem(itemData) {
        try {
            const {
                id, guild, name, description, type, rarity, price,
                max_quantity = 1, duration_hours = 0, effect_type = null,
                effect_value = null, emoji = null, variants = null
            } = itemData;

            // Add variants column if it doesn't exist
            const pragma = sql.prepare("PRAGMA table_info(items);").all();
            const hasVariants = pragma.some(col => col.name === 'variants');
            if (!hasVariants) {
                sql.prepare('ALTER TABLE items ADD COLUMN variants TEXT;').run();
            }

            sql.prepare(`
                INSERT OR REPLACE INTO items (
                    id, guild, name, description, type, rarity, price, 
                    max_quantity, duration_hours, effect_type, effect_value, 
                    emoji, variants
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, guild, name, description, type, rarity, price,
                max_quantity, duration_hours, effect_type, effect_value,
                emoji, variants ? JSON.stringify(variants) : null
            );

            return true;
        } catch (error) {
            console.error('Error storing complete item:', error);
            return false;
        }
    }

    // Repair: set type = 'food' for any item with id starting with food_ (fixes stale or wrong type in DB)
    repairFoodItemTypes(guildId) {
        try {
            const result = sql.prepare(
                'UPDATE items SET type = ? WHERE guild = ? AND id LIKE ?'
            ).run('food', guildId, 'food_%');
            return result.changes;
        } catch (error) {
            console.error('Error repairing food item types:', error);
            return 0;
        }
    }

    // Get complete item definition from database (including variants and types)
    getCompleteItem(itemId, guildId) {
        const item = sql.prepare('SELECT * FROM items WHERE id = ? AND guild = ?').get(itemId, guildId);
        return this._parseItemRow(item);
    }

    // Check if user owns a specific upgrade item
    hasUpgrade(upgradeId, userId, guildId) {
        if (upgradeId === 'farm_4x4') {
            return this.getItemCount(userId, guildId, 'farm_upgrade_4x4') > 0;
        } else if (upgradeId === 'farm_5x5') {
            return this.getItemCount(userId, guildId, 'farm_upgrade_5x5') > 0;
        } else if (upgradeId === 'farm_6x6') {
            return this.getItemCount(userId, guildId, 'farm_upgrade_6x6') > 0;
        }
        return false;
    }
}

module.exports = Inventory;