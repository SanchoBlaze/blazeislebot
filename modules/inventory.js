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
                    role_id TEXT,
                    color TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id, guild)
                );
            `).run();
            
            sql.prepare('CREATE INDEX idx_items_guild ON items (guild);').run();
            sql.prepare('CREATE INDEX idx_items_type ON items (type);').run();
            sql.prepare('CREATE INDEX idx_items_rarity ON items (rarity);').run();
        } else {
            // Check if we need to migrate existing items table
            this.migrateItemsTable();
        }
    }

    // Migrate existing items table to include guild column
    migrateItemsTable() {
        try {
            // Check if guild column exists
            const columns = sql.prepare("PRAGMA table_info(items)").all();
            const hasGuildColumn = columns.some(col => col.name === 'guild');
            
            if (!hasGuildColumn) {
                console.log('Migrating items table to include guild column...');
                
                // Create new table with guild column
                sql.prepare(`
                    CREATE TABLE items_new (
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
                        role_id TEXT,
                        color TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (id, guild)
                    );
                `).run();
                
                // Copy existing data with a default guild ID (for backward compatibility)
                sql.prepare(`
                    INSERT INTO items_new (id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, role_id, color, created_at)
                    SELECT id, 'global' as guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, role_id, color, created_at
                    FROM items
                `).run();
                
                // Drop old table and rename new one
                sql.prepare('DROP TABLE items').run();
                sql.prepare('ALTER TABLE items_new RENAME TO items').run();
                
                // Recreate indexes
                sql.prepare('CREATE INDEX idx_items_guild ON items (guild);').run();
                sql.prepare('CREATE INDEX idx_items_type ON items (type);').run();
                sql.prepare('CREATE INDEX idx_items_rarity ON items (rarity);').run();
                
                console.log('Items table migration completed successfully.');
            }
        } catch (error) {
            console.error('Error during items table migration:', error);
        }
    }

    // Populate default items for a specific guild
    populateDefaultItems(guildId) {
        // Define default items
        const defaultItems = [
            {
                id: 'xp_boost_1h',
                name: 'XP Boost (1 Hour)',
                description: 'Get 2x XP for 1 hour',
                type: 'consumable',
                rarity: 'common',
                price: 500,
                max_quantity: 10,
                duration_hours: 1,
                effect_type: 'xp_multiplier',
                effect_value: 2
            },
            {
                id: 'xp_boost_24h',
                name: 'XP Boost (24 Hours)',
                description: 'Get 2x XP for 24 hours',
                type: 'consumable',
                rarity: 'uncommon',
                price: 5000,
                max_quantity: 5,
                duration_hours: 24,
                effect_type: 'xp_multiplier',
                effect_value: 2
            },
            {
                id: 'lucky_charm',
                name: 'Lucky Charm',
                description: 'Increases work rewards by 50% for 1 hour',
                type: 'consumable',
                rarity: 'rare',
                price: 1500,
                max_quantity: 5,
                duration_hours: 1,
                effect_type: 'work_multiplier',
                effect_value: 150
            },
            {
                id: 'daily_doubler',
                name: 'Daily Doubler',
                description: 'Double your next daily reward',
                type: 'consumable',
                rarity: 'epic',
                price: 2000,
                max_quantity: 3,
                duration_hours: 0,
                effect_type: 'daily_multiplier',
                effect_value: 2
            },
            {
                id: 'mystery_box',
                name: 'Mystery Box',
                description: 'Contains a random item! Could be anything...',
                type: 'mystery',
                rarity: 'legendary',
                price: 1000,
                max_quantity: 10,
                duration_hours: 0,
                effect_type: 'random_item',
                effect_value: 1
            },
            {
                id: 'coin_multiplier_1h',
                name: 'Coin Multiplier (1 Hour)',
                description: 'Get 2x coins from all sources for 1 hour',
                type: 'consumable',
                rarity: 'rare',
                price: 3000,
                max_quantity: 3,
                duration_hours: 1,
                effect_type: 'coin_multiplier',
                effect_value: 2
            },
            {
                id: 'xp_boost_7d',
                name: 'XP Boost (7 Days)',
                description: 'Get 2x XP for 7 days - perfect for active users!',
                type: 'consumable',
                rarity: 'epic',
                price: 25000,
                max_quantity: 2,
                duration_hours: 168, // 7 days
                effect_type: 'xp_multiplier',
                effect_value: 2
            },
            {
                id: 'work_booster',
                name: 'Work Booster',
                description: 'Increases work rewards by 100% for 2 hours',
                type: 'consumable',
                rarity: 'epic',
                price: 4000,
                max_quantity: 3,
                duration_hours: 2,
                effect_type: 'work_multiplier',
                effect_value: 200
            },
            {
                id: 'premium_mystery_box',
                name: 'Premium Mystery Box',
                description: 'Contains a guaranteed rare or better item!',
                type: 'mystery',
                rarity: 'legendary',
                price: 5000,
                max_quantity: 5,
                duration_hours: 0,
                effect_type: 'premium_random_item',
                effect_value: 1
            }
        ];

        // Insert default items for the specific guild
        for (const item of defaultItems) {
            sql.prepare(`
                INSERT OR IGNORE INTO items (id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, role_id, color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                item.id, guildId, item.name, item.description, item.type, item.rarity, 
                item.price, item.max_quantity, item.duration_hours, item.effect_type, 
                item.effect_value, item.role_id, item.color
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

        // Process item effect
        let result = { success: true, message: '', effect: null };

        switch (item.effect_type) {
            case 'xp_multiplier':
                result.effect = { type: 'xp_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `XP boost activated! You'll get ${item.effect_value}x XP for ${item.duration_hours} hour(s).`;
                break;
                
            case 'work_multiplier':
                result.effect = { type: 'work_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `Work boost activated! You'll get ${item.effect_value}% more coins from work for ${item.duration_hours} hour(s).`;
                break;
                
            case 'daily_multiplier':
                result.effect = { type: 'daily_multiplier', value: item.effect_value };
                result.message = `Daily doubler activated! Your next daily reward will be doubled.`;
                break;

            case 'coin_multiplier':
                result.effect = { type: 'coin_multiplier', value: item.effect_value, duration: item.duration_hours };
                result.message = `Coin multiplier activated! You'll get ${item.effect_value}x coins from all sources for ${item.duration_hours} hour(s).`;
                break;
                
            case 'random_item':
                result = await this.openMysteryBox(userId, guildId);
                break;

            case 'premium_random_item':
                result = await this.openPremiumMysteryBox(userId, guildId);
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

    // Open premium mystery box
    async openPremiumMysteryBox(userId, guildId) {
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
            message: 'The premium mystery box was empty...',
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

    // Get rarity color
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,    // Gray
            uncommon: 0x00FF00,  // Green
            rare: 0x0080FF,      // Blue
            epic: 0x8000FF,      // Purple
            legendary: 0xD4AF37  // Gold
        };
        return colors[rarity] || colors.common;
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

    // Admin: Add item to shop
    addShopItem(itemData) {
        const {
            id, guild, name, description, type, rarity, price, 
            max_quantity = 1, duration_hours = 0, 
            effect_type = null, effect_value = 0, 
            role_id = null, color = null
        } = itemData;

        try {
            sql.prepare(`
                INSERT OR REPLACE INTO items (id, guild, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, role_id, color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, guild, name, description, type, rarity, 
                price, max_quantity, duration_hours, effect_type, 
                effect_value, role_id, color
            );
            
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
}

module.exports = Inventory; 