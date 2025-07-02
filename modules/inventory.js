const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/inventory.sqlite');

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
        
        // Load emoji configurations
        const emojiConfigs = require('../config/emoji-configs.json');
        
        // Load bot configuration to determine which emoji set to use
        const config = require('../config/default.json');
        
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

    // Get items by type for a guild
    getItemsByType(type, guildId) {
        return sql.prepare('SELECT * FROM items WHERE type = ? AND guild = ? ORDER BY price ASC').all(type, guildId);
    }

    // Get all fish items for a guild (optimized for fishing)
    getAllFish(guildId) {
        return sql.prepare('SELECT * FROM items WHERE type = ? AND guild = ? ORDER BY rarity ASC, price ASC').all('fish', guildId);
    }

    // Get user's inventory
    getUserInventory(userId, guildId) {
        return sql.prepare(`
            SELECT i.*, inv.quantity, inv.acquired_at, inv.expires_at
            FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user = ? AND inv.guild = ?
            ORDER BY i.rarity DESC, i.name ASC
        `).all(userId, guildId);
    }

    // Add item to user's inventory
    addItem(userId, guildId, itemId, quantity = 1) {
        console.log(`[addItem] Called for user ${userId} in guild ${guildId} for item ${itemId} (quantity: ${quantity})`);
        const item = this.getItem(itemId, guildId);
        if (!item) throw new Error('Item not found');

        const expiresAt = item.duration_hours > 0 
            ? new Date(Date.now() + item.duration_hours * 60 * 60 * 1000).toISOString()
            : null;

        try {
            sql.prepare(`
                INSERT INTO inventory (user, guild, item_id, quantity, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user, guild, item_id) 
                DO UPDATE SET 
                    quantity = quantity + ?,
                    expires_at = CASE 
                        WHEN ? IS NOT NULL THEN ?
                        ELSE expires_at 
                    END
            `).run(userId, guildId, itemId, quantity, expiresAt, quantity, expiresAt, expiresAt);
            
            // After updating or inserting, log the new quantity
            const userItem = this.getUserItem(userId, guildId, itemId);
            if (userItem) {
                console.log(`[addItem] After operation: user ${userId} now has ${userItem.quantity} of item ${itemId}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error adding item to inventory:', error);
            return false;
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
                
            default:
                result.message = `Used ${item.name}.`;
        }

        // Remove item if it's consumable
        if (item.type === 'consumable' || item.type === 'mystery') {
            this.removeItem(userId, guildId, itemId, 1);
        }

        return result;
    }

    // Open mystery box
    async openMysteryBox(userId, guildId) {
        const allItems = this.getAllItems(guildId).filter(item => item.type !== 'mystery');
        const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
        
        if (randomItem) {
            this.addItem(userId, guildId, randomItem.id, 1);
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
    async openRareMysteryBox(userId, guildId) {
        const allItems = this.getAllItems(guildId).filter(item => 
            item.type !== 'mystery' && 
            (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary')
        );
        
        if (allItems.length === 0) {
            // Fallback to regular items if no rare+ items exist
            const fallbackItems = this.getAllItems(guildId).filter(item => item.type !== 'mystery');
            const randomItem = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
            
            if (randomItem) {
                this.addItem(userId, guildId, randomItem.id, 1);
                return {
                    success: true,
                    message: `🎉 You found **${randomItem.name}** in the premium mystery box!`,
                    effect: { type: 'item_received', item: randomItem }
                };
            }
        } else {
            const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
            this.addItem(userId, guildId, randomItem.id, 1);
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
        const expired = sql.prepare('SELECT * FROM inventory WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP').all();
        
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
            return { success: false, message: `You don't have enough ${item.name} to sell.` };
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
        const expiresAt = durationHours > 0 
            ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default 24 hours for effects without duration

        try {
            sql.prepare(`
                INSERT INTO active_effects (user, guild, effect_type, effect_value, expires_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(userId, guildId, effectType, effectValue, expiresAt);
            
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
            WHERE user = ? AND guild = ? AND effect_type = ? AND expires_at > CURRENT_TIMESTAMP
        `).get(userId, guildId, effectType);
        
        return effect || null;
    }

    // Get all active effects for a user
    getActiveEffects(userId, guildId) {
        return sql.prepare(`
            SELECT * FROM active_effects 
            WHERE user = ? AND guild = ? AND expires_at > CURRENT_TIMESTAMP
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

    // Clean up expired effects
    cleanupExpiredEffects() {
        try {
            const result = sql.prepare(`
                DELETE FROM active_effects 
                WHERE expires_at <= CURRENT_TIMESTAMP
            `).run();
            
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired effects:', error);
            return 0;
        }
    }

    // Get work multiplier for a user
    getWorkMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'work_multiplier');
        return effect ? effect.effect_value : 1; // Return multiplier directly (2 = 2x, 3 = 3x)
    }

    // Get XP multiplier for a user
    getXPMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'xp_multiplier');
        return effect ? effect.effect_value : 1;
    }

    // Get coin multiplier for a user
    getCoinMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'coin_multiplier');
        return effect ? effect.effect_value : 1;
    }

    // Check if user has daily multiplier
    hasDailyMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'daily_multiplier');
        return !!effect;
    }

    // Get daily multiplier for a user
    getDailyMultiplier(userId, guildId) {
        const effect = this.getActiveEffect(userId, guildId, 'daily_multiplier');
        return effect ? effect.effect_value : 1;
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
}

module.exports = Inventory; 