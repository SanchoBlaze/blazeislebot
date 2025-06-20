const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db = null;

async function initializeDatabase() {
    if (db) return db;
    
    db = await open({
        filename: path.join(__dirname, '..', 'data', 'economy.db'),
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS economy (
            userId TEXT NOT NULL,
            guildId TEXT NOT NULL,
            wallet INTEGER DEFAULT 0,
            bank INTEGER DEFAULT 0,
            lastDaily TEXT,
            lastWeekly TEXT,
            lastWork TEXT,
            PRIMARY KEY (userId, guildId)
        );

        CREATE TABLE IF NOT EXISTS items (
            userId TEXT NOT NULL,
            guildId TEXT NOT NULL,
            itemName TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (userId, guildId, itemName)
        );

        CREATE TABLE IF NOT EXISTS shop (
            guildId TEXT NOT NULL,
            itemName TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            PRIMARY KEY (guildId, itemName)
        );
    `);

    return db;
}

// User balance operations
async function getUser(userId, guildId) {
    const db = await initializeDatabase();
    let user = await db.get('SELECT * FROM economy WHERE userId = ? AND guildId = ?', [userId, guildId]);
    
    if (!user) {
        await db.run(
            'INSERT INTO economy (userId, guildId, wallet, bank) VALUES (?, ?, 0, 0)',
            [userId, guildId]
        );
        user = { userId, guildId, wallet: 0, bank: 0 };
    }
    
    return user;
}

async function updateBalance(userId, guildId, walletChange = 0, bankChange = 0) {
    const db = await initializeDatabase();
    await db.run(
        `UPDATE economy 
         SET wallet = wallet + ?,
             bank = bank + ?
         WHERE userId = ? AND guildId = ?`,
        [walletChange, bankChange, userId, guildId]
    );
}

async function setBalance(userId, guildId, wallet, bank) {
    const db = await initializeDatabase();
    await db.run(
        `UPDATE economy 
         SET wallet = ?,
             bank = ?
         WHERE userId = ? AND guildId = ?`,
        [wallet, bank, userId, guildId]
    );
}

async function updateLastAction(userId, guildId, action) {
    const db = await initializeDatabase();
    const now = new Date().toISOString();
    await db.run(
        `UPDATE economy 
         SET ${action} = ?
         WHERE userId = ? AND guildId = ?`,
        [now, userId, guildId]
    );
}

module.exports = {
    initializeDatabase,
    getUser,
    updateBalance,
    setBalance,
    updateLastAction
}; 