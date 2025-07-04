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
3. **Fishing**: Catch fish to sell (prices vary by rarity, 30-minute cooldown)
4. **Level Up Rewards**: Earn coins when leveling up (`/level` command or chat activity)
   - **Levels 1-5**: 50 coins per level
   - **Levels 6-10**: 100 coins per level
   - **Levels 11-20**: 200 coins per level
   - **Levels 21-30**: 350 coins per level
   - **Levels 31-50**: 500 coins per level
   - **Levels 51+**: 750 coins per level
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

### Interactive UI & Item Usage
- All shop, sell, and use commands now feature a modern interactive paginator UI:
  - One item per page, with navigation arrows
  - Filter dropdown to sort by item type
  - Action button (Buy, Sell, Use) for each item
  - Emoji thumbnails for each item, including custom emojis
  - When using an item that gives a reward (like a scratch card or mystery box), the reward's emoji is shown as the embed thumbnail
- Improved error handling and global interaction logic: No more failed interactions or double reply errors
- Admin commands are now robust and stable, preventing double reply errors

### 🎟️ Scratch Card Item
- **Type:** Consumable, Uncommon
- **Price:** 300 coins
- **Effect:** 50% chance to get nothing, 30% chance to win 100–1000 coins, 20% chance to win an item of any rarity (weighted by rarity)
- **Reward:** If you win an item, its emoji is shown as the embed thumbnail

### 💸 Profit Margin Logic
- All item prices are set so users always make a profit when using or selling them
- Profit margins are transparent and based on rarity

### 🏆 Net Worth XP Bonuses
- Earn one-time XP bonuses for reaching net worth milestones (wallet + bank):
  - 10,000 coins: 250 XP
  - 50,000 coins: 750 XP
  - 100,000 coins: 1,500 XP
  - 250,000 coins: 3,000 XP
  - 500,000 coins: 6,000 XP
  - 1,000,000 coins: 12,000 XP
- Each bonus is awarded only once per user per threshold.
- When a milestone is reached, a non-ephemeral notification is sent in the economy channel, featuring the user's avatar and milestone details.

## Commands

### 💰 Economy Commands
- `/balance` - Check your wallet and bank balance
- `/daily` - Collect your daily reward (cooldown: 24 hours)
- `/work` - Work to earn coins (cooldown: 1 hour)
- `/fish` - Go fishing to catch fish (cooldown: 30 minutes)
- `/deposit <amount>` - Move coins from wallet to bank
- `/withdraw <amount>` - Move coins from bank to wallet
- `/transfer <user> <amount>` - Send coins to another user
- `/leaderboard` - View the richest users in the server
- `/history` - View your transaction history
- `/help-economy` - Get help with economy commands

### 🛒 Shop & Inventory Commands
- `/shop` - Browse and buy items from the shop
- `/inventory [user]` - View your or another user's inventory
- `/use <item>` - Use an item from your inventory
- `/sell` - Sell items back to the shop (rarity-based pricing)

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

### 🎣 Fishing System

The fishing system allows players to catch fish and sell them for coins. Fish have different rarities and sell prices, and fishing rods can improve your chances of catching rare fish.

#### Fishing Mechanics
- **Cooldown**: 30 minutes between fishing sessions
- **Fish Rarities**: Common, Uncommon, Rare, Epic, Legendary
- **Sell Prices**: Fish can be sold back to the shop for coins
- **Fishing Rods**: Permanent items that boost rare fish catch rates
- **Admin Control**: Server admins can add custom fish using `/economy-admin add-item`

#### Default Fish Types
- **Common**: Tiny Minnow (5 coins), Small Bass (8 coins)
- **Uncommon**: Medium Trout (15 coins), Large Salmon (25 coins)
- **Rare**: Golden Carp (50 coins), Crystal Fish (75 coins)
- **Epic**: Diamond Tuna (150 coins)
- **Legendary**: Legendary Kraken (500 coins)

#### Fishing Rods
- **Basic Fishing Rod** (Common) - 1,000 coins - 1.2x rare fish boost
- **Steel Fishing Rod** (Uncommon) - 5,000 coins - 1.5x rare fish boost
- **Golden Fishing Rod** (Rare) - 15,000 coins - 2.0x rare fish boost
- **Crystal Fishing Rod** (Epic) - 50,000 coins - 3.0x rare fish boost
- **Legendary Fishing Rod** (Legendary) - 100,000 coins - 5.0x rare fish boost

#### How Fishing Rods Work
- **Permanent Items**: Fishing rods don't expire or need to be used
- **Best Rod Active**: Only the best fishing rod in your inventory provides the boost
- **Rare Fish Only**: Boost only applies to rare, epic, and legendary fish
- **Progressive Investment**: Higher-tier rods cost more but provide better boosts

### 📦 Available Items

The shop offers various items that users can purchase with their coins:

#### 🎣 Fishing Items
- **Fish**: Various fish types with different rarities and sell prices
- **Fishing Rods**: Permanent items that boost rare fish catch rates

#### ⚡ Consumable Items
- **XP Boost (1 Hour)** (Common) - 500 coins - 2x XP for 1 hour
- **XP Boost (24 Hours)** (Uncommon) - 5,000 coins - 2x XP for 24 hours
- **XP Boost (7 Days)** (Epic) - 25,000 coins - 2x XP for 7 days
- **Lucky Charm** (Rare) - 1,500 coins - 2x work rewards for 1 hour
- **Work Booster** (Epic) - 4,000 coins - 3x work rewards for 2 hours
- **Daily Doubler** (Epic) - 2,000 coins - 2x daily rewards for 24 hours
- **Daily Booster** (Legendary) - 10,000 coins - 5x daily rewards for 1 hour
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
- **Effect**: Multiply your daily rewards (2x, 5x, etc.)
- **Duration**: Varies by item (1 hour to 24 hours)
- **One Per Type**: You can only have one daily multiplier active at a time
- **Usage**: Use before claiming daily reward for maximum efficiency

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
    last_fishing TEXT,
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
- **Fishing**: Variable based on fish caught (5-500 coins per fish, 30-minute cooldown)
- **Total Weekly Potential**: ~4,270-4,550+ coins for active users (fishing adds additional income)

## Item Strategy Guide

### 🎯 For New Users
1. **Start with daily rewards** - Consistent income
2. **Fish regularly** - Additional income source
3. **Buy XP boosts** - Accelerate leveling
4. **Save for roles** - Permanent status symbols

### 💎 For Active Users
1. **Use work multipliers** - Maximize work efficiency
2. **Fish regularly** - Steady additional income
3. **Buy fishing rods** - Improve rare fish chances
4. **Buy mystery boxes** - Gamble for rare items
5. **Invest in daily doublers** - Double your income

### 🏆 For Wealthy Users
1. **Collect rare items** - Show off your status
2. **Buy custom roles** - Personalize your experience
3. **Help others** - Transfer coins to new members

### ⚠️ Effect Management Rules
- **One Effect Per Type**: You can only have one active effect of each type at a time
  - **Example**: You cannot use a 1-hour XP boost while a 24-hour XP boost is active
  - **Example**: You cannot use a work booster while a lucky charm is active
  - **Example**: You cannot use a daily doubler while a daily booster is active
- **No Effect Replacement**: Using a new effect of the same type will be blocked
- **Wait for Expiration**: You must wait for the current effect to expire before using another
- **Check Active Effects**: Use `/effects` to see your active effects and remaining time
- **Clear Error Messages**: The bot will tell you exactly which effect is blocking usage

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