const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/inventory.sqlite');

class Inventory {

    constructor(client) {
        this.client = client;
        this.setupDatabase();
        this.initializeItems();
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
                    id TEXT PRIMARY KEY,
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
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `).run();
            
            sql.prepare('CREATE INDEX idx_items_type ON items (type);').run();
            sql.prepare('CREATE INDEX idx_items_rarity ON items (rarity);').run();
        }
    }

    initializeItems() {
        // Define default items
        const defaultItems = [
            {
                id: 'bronze_role',
                name: 'Bronze Role',
                description: 'A special bronze role that shows your dedication to the server',
                type: 'role',
                rarity: 'common',
                price: 1000,
                max_quantity: 1,
                duration_hours: 0,
                effect_type: 'role',
                role_id: null, // Will be set by admin
                color: '#CD7F32'
            },
            {
                id: 'silver_role',
                name: 'Silver Role',
                description: 'A prestigious silver role for active community members',
                type: 'role',
                rarity: 'uncommon',
                price: 2500,
                max_quantity: 1,
                duration_hours: 0,
                effect_type: 'role',
                role_id: null,
                color: '#C0C0C0'
            },
            {
                id: 'gold_role',
                name: 'Gold Role',
                description: 'An exclusive gold role for the most dedicated members',
                type: 'role',
                rarity: 'rare',
                price: 5000,
                max_quantity: 1,
                duration_hours: 0,
                effect_type: 'role',
                role_id: null,
                color: '#FFD700'
            },
            {
                id: 'custom_color_role',
                name: 'Custom Color Role',
                description: 'Create your own personalized colored role',
                type: 'custom_role',
                rarity: 'epic',
                price: 3000,
                max_quantity: 1,
                duration_hours: 0,
                effect_type: 'custom_role',
                color: null // User chooses
            },
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
            }
        ];

        // Insert default items if they don't exist
        for (const item of defaultItems) {
            sql.prepare(`
                INSERT OR IGNORE INTO items (id, name, description, type, rarity, price, max_quantity, duration_hours, effect_type, effect_value, role_id, color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                item.id, item.name, item.description, item.type, item.rarity, 
                item.price, item.max_quantity, item.duration_hours, item.effect_type, 
                item.effect_value, item.role_id, item.color
            );
        }
    }

    // Get item definition
    getItem(itemId) {
        return sql.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    }

    // Get all items
    getAllItems() {
        return sql.prepare('SELECT * FROM items ORDER BY price ASC').all();
    }

    // Get items by type
    getItemsByType(type) {
        return sql.prepare('SELECT * FROM items WHERE type = ? ORDER BY price ASC').all(type);
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
        const item = this.getItem(itemId);
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
        const item = this.getItem(itemId);
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
                
            case 'random_item':
                result = await this.openMysteryBox(userId, guildId);
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
        const allItems = this.getAllItems().filter(item => item.type !== 'mystery');
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
}

module.exports = Inventory; 