# Economy System Documentation

## Overview

The Blaze Isle Bot now includes a comprehensive economy system that allows users to earn, spend, and manage virtual currency within Discord servers. The system features a dual-currency system with wallet and bank accounts, daily rewards, work opportunities, an interactive shop, and a complete inventory system with items and effects.

## Features

### 💰 Currency System
- **Wallet**: Immediate spending money
- **Bank**: Safe storage for savings
- **Net Worth**: Total value (wallet + bank)
- **Transaction History**: Complete record of all transactions

### 🎯 Earning Methods
1. **Daily Rewards**: 100 coins every 24 hours (`/daily`)
2. **Work**: 10-50 coins every hour (`/work`)
3. **Level Up Rewards**: Earn coins when leveling up (`/level` command or chat activity)
   - **Levels 1-5**: 50 coins per level
   - **Levels 6-10**: 100 coins per level
   - **Levels 11-20**: 200 coins per level
   - **Levels 21-30**: 350 coins per level
   - **Levels 31-50**: 500 coins per level
   - **Levels 51+**: 750 coins per level
4. **Chat Activity**: 1 coin per message (automatic)
5. **Admin Rewards**: Server administrators can give coins

### 🏦 Banking System
- **Deposit**: Move coins from wallet to bank (`/deposit`)
- **Withdraw**: Move coins from bank to wallet (`/withdraw`)
- **Transfer**: Send coins to other users (`/transfer`)

### 📦 Inventory System
- **Item Storage**: Store and manage purchased items
- **Rarity System**: Common, Uncommon, Rare, Epic, Legendary items
- **Item Effects**: Temporary boosts and permanent rewards
- **Quantity Management**: Stack multiple items with limits
- **Expiration System**: Time-limited items with automatic cleanup

### 📊 Information & Statistics
- **Balance Check**: View your or others' balances (`/balance`)
- **Leaderboard**: See richest users (`/economy-leaderboard`)
- **Transaction History**: View recent transactions (`/history`)
- **Inventory View**: Check your or others' items (`/inventory`)
- **Server Statistics**: Economy overview for admins (`/economy-admin stats`)

### 🎉 Level-Up Rewards
- **Tiered System**: Higher levels earn more coins
- **Automatic Rewards**: Coins awarded immediately upon leveling up
- **Multiple Level Gains**: Rewards calculated for each level gained
- **Transaction Logging**: All level-up rewards tracked in transaction history
- **Integration**: Seamlessly connects loyalty and economy systems

### 🛒 Shop System
- **Interactive Dropdown**: Select items from a dropdown menu for purchase
- **Pagination**: Navigate through unlimited items with page buttons
- **Item Rarity**: Visual rarity indicators with colors and emojis
- **Quantity Limits**: Prevent hoarding with maximum quantities
- **Real-time Validation**: Check affordability and limits before purchase
- **Rich Item Descriptions**: Detailed information about each item
- **Guild-Specific**: Each guild has its own shop items and configuration
- **Scalable**: Handles unlimited items without Discord component limits

### 🛠️ Shop Management
- **Custom Items**: Admins can add custom items with full configuration
- **Item Removal**: Remove unwanted items from the shop
- **Default Population**: Easily populate shop with default items
- **Item Listing**: View all items with detailed information
- **Flexible Configuration**: Set prices, rarities, effects, and limits
- **Guild Isolation**: Each guild's shop is completely independent

## Commands

### User Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/balance` | Check balance | `/balance [user]` |
| `/daily` | Claim daily reward | `/daily` |
| `/work` | Work for coins | `/work` |
| `/deposit` | Deposit to bank | `/deposit <amount>` |
| `/withdraw` | Withdraw from bank | `/withdraw <amount>` |
| `/transfer` | Send coins to user | `/transfer <user> <amount>` |
| `/economy-leaderboard` | Show richest users | `/economy-leaderboard [limit]` |
| `/history` | Show transactions | `/history [user] [limit]` |
| `/inventory` | View inventory | `/inventory [user]` |
| `/use` | Use an item | `/use <item>` |
| `/shop` | View shop | `/shop [page]` |
| `/economy-help` | Get help | `/economy-help` |

### Admin Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/economy-admin add` | Add coins to user | `/economy-admin add <user> <amount>` |
| `/economy-admin remove` | Remove coins from user | `/economy-admin remove <user> <amount>` |
| `/economy-admin set` | Set user's balance | `/economy-admin set <user> <amount>` |
| `/economy-admin stats` | Show server stats | `/economy-admin stats` |
| `/economy-admin add-item` | Add new item to shop | `/economy-admin add-item` |
| `/economy-admin remove-item` | Remove item from shop | `/economy-admin remove-item <id>` |
| `/economy-admin list-items` | List all shop items | `/economy-admin list-items` |
| `/economy-admin populate-defaults` | Add default items to shop | `/economy-admin populate-defaults` |

## Item System

### 🏷️ Item Rarity System

| Rarity | Emoji | Color | Description |
|--------|-------|-------|-------------|
| **Common** | ⚪ | Gray | Basic items, easily obtainable |
| **Uncommon** | 🟢 | Green | Better items, moderate value |
| **Rare** | 🔵 | Blue | Premium items, high value |
| **Epic** | 🟣 | Purple | Special items, very valuable |
| **Legendary** | 🟡 | Gold | Exclusive items, extremely rare |

### 📦 Available Items

#### 🎭 Role Items
- **Bronze Role** (Common) - 1,000 coins - Special bronze role
- **Silver Role** (Uncommon) - 2,500 coins - Prestigious silver role  
- **Gold Role** (Rare) - 5,000 coins - Exclusive gold role
- **Custom Color Role** (Epic) - 3,000 coins - Personalized colored role

#### ⚡ Consumable Items
- **XP Boost (1 Hour)** (Common) - 500 coins - 2x XP for 1 hour
- **XP Boost (24 Hours)** (Uncommon) - 5,000 coins - 2x XP for 24 hours
- **Lucky Charm** (Rare) - 1,500 coins - 50% more work rewards for 1 hour
- **Daily Doubler** (Epic) - 2,000 coins - Double your next daily reward

#### 🎁 Mystery Items
- **Mystery Box** (Legendary) - 1,000 coins - Contains a random item

### 🎯 Item Effects

#### XP Multipliers
- **Effect**: Temporarily increase XP gain from all sources
- **Duration**: 1 hour or 24 hours
- **Usage**: Use before engaging in activities that give XP

#### Work Multipliers
- **Effect**: Increase coins earned from work command
- **Duration**: 1 hour
- **Usage**: Use before working for maximum efficiency

#### Daily Multipliers
- **Effect**: Double your next daily reward
- **Duration**: Until next daily claim
- **Usage**: Use before claiming daily reward

#### Mystery Boxes
- **Effect**: Receive a random item from the shop
- **Duration**: Instant
- **Usage**: Gamble for rare items

## Database Structure

### Economy Table
```sql
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
```

### Transactions Table
```sql
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
```

### Inventory Table
```sql
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
```

### Items Table
```sql
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
```

## Cooldowns & Limits

- **Daily Reward**: 24 hours
- **Work**: 1 hour
- **Transfer**: No cooldown (limited by balance)
- **Deposit/Withdraw**: No cooldown (limited by available funds)
- **Item Usage**: Varies by item type
- **Shop Purchases**: Limited by item max quantities

## Economy Balance

The system is designed to maintain a healthy economy:

- **Daily Reward**: 100 coins (4,200 coins per week)
- **Work**: 10-50 coins per hour (70-350 coins per week)
- **Chat Activity**: 1 coin per message
- **Total Weekly Potential**: ~4,270-4,550 coins for active users

## Item Strategy Guide

### 🎯 For New Users
1. **Start with daily rewards** - Consistent income
2. **Buy XP boosts** - Accelerate leveling
3. **Save for roles** - Permanent status symbols

### 💎 For Active Users
1. **Use work multipliers** - Maximize work efficiency
2. **Buy mystery boxes** - Gamble for rare items
3. **Invest in daily doublers** - Double your income

### 🏆 For Wealthy Users
1. **Collect rare items** - Show off your status
2. **Buy custom roles** - Personalize your experience
3. **Help others** - Transfer coins to new members

## Security Features

- **Negative Balance Prevention**: Users cannot go below 0 coins
- **Transaction Logging**: All transactions are recorded with timestamps
- **Admin Permissions**: Only administrators can modify user balances
- **Data Validation**: All inputs are validated before processing
- **Item Expiration**: Automatic cleanup of expired items
- **Quantity Limits**: Prevent exploitation through item hoarding

## Integration with Existing Systems

The economy system integrates seamlessly with the existing bot features:

- **Loyalty System**: Works alongside the XP/leveling system
- **Guild Settings**: Uses the same configuration system
- **Database**: Follows the same SQLite pattern as other modules
- **Error Handling**: Consistent with bot-wide error handling
- **Item Effects**: Enhance existing systems (XP, work, daily rewards)

## Future Enhancements

Planned features for future updates:

1. **Gambling Games**: Dice, slots, blackjack
2. **Investment System**: Interest on bank deposits
3. **Auction House**: User-to-user item trading
4. **Custom Shop Items**: Server-specific rewards
5. **Economy Events**: Special earning opportunities
6. **Tax System**: Server revenue generation
7. **Multiplier Events**: Temporary earning boosts
8. **Item Crafting**: Combine items to create new ones
9. **Achievement System**: Rewards for economic milestones
10. **Market Fluctuations**: Dynamic pricing based on demand

## Configuration

The economy system requires no additional configuration beyond the standard bot setup. All features are enabled by default and work automatically when users join the server.

## Troubleshooting

### Common Issues

1. **"User not found"**: User will be automatically created on first command
2. **"Insufficient funds"**: Check balance with `/balance`
3. **"Cooldown active"**: Wait for the specified time before trying again
4. **"Item not in inventory"**: Check inventory with `/inventory`
5. **"Item has expired"**: Expired items are automatically removed
6. **"Maximum quantity reached"**: You can't buy more of that item
7. **Database errors**: Check file permissions in the `db/` directory

### Admin Tools

Use `/economy-admin stats` to monitor the economy health and `/economy-admin add` to help users who encounter issues.

## Support

For issues or questions about the economy system:

1. Check this documentation
2. Use `/economy-help` in Discord
3. Contact server administrators
4. Review transaction history for discrepancies

---

*Economy System v2.0 - Blaze Isle Bot* 