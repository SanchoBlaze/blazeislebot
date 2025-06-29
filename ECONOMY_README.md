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
- **Item Storage**: Store items you purchase from the shop
- **Item Usage**: Use consumable items for temporary effects
- **Scaled Selling**: Sell items back to the shop with rarity-based pricing
- **Quantity Management**: Track how many of each item you own
- **Expiration Tracking**: See when temporary items expire
- **Rarity Display**: Visual indicators for item rarity
- **Price Information**: See both buy and sell prices for items

### 💰 Sell System
- **Rarity-Based Pricing**: Rarer items get higher sell percentages
  - **Common**: 40% of original price
  - **Uncommon**: 50% of original price
  - **Rare**: 60% of original price
  - **Epic**: 70% of original price
  - **Legendary**: 80% of original price
- **Flexible Quantities**: Sell any amount of items you own
- **Transparent Pricing**: See sell percentages in inventory and autocomplete
- **Fair Value**: Better returns for valuable items

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

The shop offers various items that users can purchase with their coins:

### Item Types
- **Consumable Items**: XP boosts, work multipliers, daily doublers, coin multipliers
- **Mystery Boxes**: Contain random items when opened
- **Premium Mystery Boxes**: Guaranteed rare or better items

### Item Rarities
- **Common** (White): Basic items, low cost
- **Uncommon** (Green): Better items, moderate cost  
- **Rare** (Blue): Powerful items, high cost
- **Epic** (Purple): Very powerful items, very high cost
- **Legendary** (Orange): Extremely powerful items, extremely high cost

### 🛠️ Shop Management
- **Add Items**: `/economy-admin add-item` - Add new items to the shop
- **Remove Items**: `/economy-admin remove-item` - Remove items from the shop
- **List Items**: `/economy-admin list-items` - View all shop items
- **Populate Defaults**: `/economy-admin populate-defaults` - Add default items to new guilds

### 📦 Item Management
- **Item Types**: Consumable items, mystery boxes
- **Effect Types**: XP multipliers, work multipliers, daily multipliers, coin multipliers, random items
- **Rarity System**: Common to Legendary with visual indicators
- **Quantity Limits**: Prevent item hoarding
- **Duration Effects**: Temporary boosts with expiration times

## Commands

### 💰 Economy Commands
- `/balance` - Check your wallet and bank balance
- `/daily` - Collect your daily reward (cooldown: 24 hours)
- `/work` - Work to earn coins (cooldown: 1 hour)
- `/deposit <amount>` - Move coins from wallet to bank
- `/withdraw <amount>` - Move coins from bank to wallet
- `/transfer <user> <amount>` - Send coins to another user
- `/leaderboard` - View the richest users in the server
- `/history` - View your transaction history

### 🛒 Shop & Inventory Commands
- `/shop` - Browse and buy items from the shop
- `/inventory [user]` - View your or another user's inventory
- `/use <item>` - Use an item from your inventory
- `/sell <item> [quantity]` - Sell items back to the shop (rarity-based pricing)

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

| Rarity | Emoji | Colour | Description |
|--------|-------|--------|-------------|
| **Common** | ⚪ | White | Basic items, low cost |
| **Uncommon** | 🟢 | Green | Better items, moderate cost |
| **Rare** | 🔵 | Blue | Powerful items, high cost |
| **Epic** | 🟣 | Purple | Very powerful items, very high cost |
| **Legendary** | 🟡 | Gold | Extremely powerful items, extremely high cost |

### 📦 Available Items

The shop offers various items that users can purchase with their coins:

#### ⚡ Consumable Items
- **XP Boost (1 Hour)** (Common) - 500 coins - 2x XP for 1 hour
- **XP Boost (24 Hours)** (Uncommon) - 5,000 coins - 2x XP for 24 hours
- **XP Boost (7 Days)** (Epic) - 25,000 coins - 2x XP for 7 days
- **Lucky Charm** (Rare) - 1,500 coins - 50% more work rewards for 1 hour
- **Work Booster** (Epic) - 4,000 coins - 100% more work rewards for 2 hours
- **Daily Doubler** (Epic) - 2,000 coins - Double your next daily reward
- **Coin Multiplier (1 Hour)** (Rare) - 3,000 coins - 2x coins from all sources for 1 hour

#### 🎁 Mystery Items
- **Mystery Box** (Legendary) - 1,000 coins - Contains a random item
- **Premium Mystery Box** (Legendary) - 5,000 coins - Contains a guaranteed rare or better item

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
    colour TEXT,
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