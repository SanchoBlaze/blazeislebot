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
3. **Fishing**: Catch fish to sell (prices vary by rarity, dynamic cooldown based on rod)
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

The shop offers various items that users can purchase with their coins. The shop features an interactive paginator interface with filtering options and bulk purchase capabilities:

#### Shop Features
- **Interactive Paginator**: Navigate through items with arrow buttons
- **Item Filtering**: Filter items by type (seeds, fishing rods, consumables, etc.)
- **Single Purchase**: Buy one item at a time with the "Buy" button
- **Bulk Purchase**: Buy multiple items at once with the "Buy Quantity" modal
- **Real-time Balance**: See your current balance and net worth
- **Quantity Limits**: Respects item maximum quantities
- **Affordability Check**: Buttons are disabled if you can't afford items

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
- `/fish` - Go fishing to catch fish (dynamic cooldown based on rod)
- `/deposit <amount>` - Move coins from wallet to bank
- `/withdraw <amount>` - Move coins from bank to wallet
- `/transfer <user> <amount>` - Send coins to another user
- `/leaderboard` - View the richest users in the server
- `/history` - View your transaction history
- `/help-economy` - Get help with economy commands

### 🛒 Shop & Inventory Commands
- `/shop` - Browse and buy items from the shop (with bulk purchase options via "Buy Quantity" modal)
- `/inventory [user]` - View your or another user's inventory (shows crop variants and watering cans, deduplicated by item and variant)
- `/use <item>` - Use an item from your inventory
- `/sell` - Sell items back to the shop (rarity-based pricing, supports crop variants and confirmation messages)

### 🌾 Farming Commands
- `/farm view` - Interactive farming interface with buttons for planting, harvesting, and farm management
- `/leaderboard farm` - View top users by crops harvested

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
| **Mythic** | 🌈 | Magenta | Ultimate items, extremely high cost |

### 🌾 Farming System

The farming system allows players to plant, grow, and harvest crops for profit. The system features crop variants, watering cans for growth acceleration, and full integration with the economy and inventory systems.

#### Farming Mechanics
- **Planting**: Plant seeds to grow crops using the interactive `/farm` interface
- **Growth Times**: Each crop has a base growth time (26-58 minutes) that can be reduced with watering cans
- **Harvesting**: Collect fully grown crops using the interactive `/farm` interface
- **Crop Variants**: Many crops have multiple variants (e.g., red, yellow, green peppers)
- **Watering Cans**: Permanent items that reduce crop growth times (similar to fishing rods for cooldown reduction)
- **Fertilisers**: Consumable items that increase crop yield with rarity-based success rates

#### Watering Cans
- **Wood** (Common) - 500 coins - 0.95x growth (5% faster)
- **Copper** (Uncommon) - 2,000 coins - 0.9x growth (10% faster)
- **Silver** (Rare) - 8,000 coins - 0.85x growth (15% faster)
- **Gold** (Epic) - 25,000 coins - 0.8x growth (20% faster)
- **Diamond** (Legendary) - 75,000 coins - 0.7x growth (30% faster)
- **Mythic** (Mythic) - 200,000 coins - 0.6x growth (40% faster)

#### Fertilisers
- **Basic** (Common) - 100 coins - 5% yield boost (80% success on common crops)
- **Premium** (Uncommon) - 300 coins - 10% yield boost (60% success on uncommon crops)
- **Organic** (Rare) - 800 coins - 20% yield boost (40% success on rare crops)
- **Magical** (Epic) - 2,000 coins - 30% yield boost (25% success on epic crops)
- **Legendary** (Legendary) - 5,000 coins - 40% yield boost (15% success on legendary crops)
- **Mythic** (Mythic) - 15,000 coins - 50% yield boost (5% success on mythic crops)

#### Crop Variants
- **Unique Items**: Each variant is treated as a separate item in inventory
- **Visual Distinction**: Different emojis and names for each variant
- **Database Storage**: Variants are stored with a `variant` field
- **Sell System**: Crops can be sold with rarity-based pricing
- **Weeds crop**: Weeds can grow on empty plots (5% chance per hour per plot) and are managed as a harvestable crop with their own emoji.
- **Emoji config requirement**: Whenever you add a new item to data/default-items.json, you must also add a corresponding entry to config/emoji-configs.json with the correct emoji (Unicode or custom).

### 🎣 Fishing System

The fishing system allows players to catch fish and sell them for coins. The system features fishing rods for cooldown reduction and bait for rarity boosts, mirroring the farming system design.

#### Fishing Mechanics
- **Dynamic Cooldown**: 18-30 minutes between fishing sessions (based on your best fishing rod)
- **Fish Rarities**: Common, Uncommon, Rare, Epic, Legendary
- **Sell Prices**: Fish can be sold back to the shop for coins
- **Fishing Rods**: Permanent items that reduce fishing cooldown
- **Bait**: Consumable items that boost rare fish catch rates with success rates
- **Admin Control**: Server admins can add custom fish using `/economy-admin add-item`

#### Default Fish Types
- **Common**: Tiny Minnow (5 coins), Small Bass (8 coins)
- **Uncommon**: Medium Trout (15 coins), Large Salmon (25 coins)
- **Rare**: Golden Carp (50 coins), Crystal Fish (75 coins)
- **Epic**: Diamond Tuna (150 coins)
- **Legendary**: Legendary Kraken (500 coins)

#### Fishing Rods (Cooldown Reduction)
- **Basic Fishing Rod** (Common) - 1,000 coins - 5% faster (28.5 min cooldown)
- **Steel Fishing Rod** (Uncommon) - 5,000 coins - 10% faster (27 min cooldown)
- **Golden Fishing Rod** (Rare) - 15,000 coins - 15% faster (25.5 min cooldown)
- **Crystal Fishing Rod** (Epic) - 50,000 coins - 20% faster (24 min cooldown)
- **Legendary Fishing Rod** (Legendary) - 100,000 coins - 30% faster (21 min cooldown)
- **Mythic Fishing Rod** (Mythic) - 250,000 coins - 40% faster (18 min cooldown)

#### Bait (Rarity Boost)
- **Basic Bait** (Common) - 100 coins - 1.2x rare fish boost, 80% success rate
- **Premium Bait** (Uncommon) - 300 coins - 1.5x rare fish boost, 60% success rate
- **Magic Bait** (Rare) - 800 coins - 2.0x rare fish boost, 40% success rate
- **Epic Bait** (Epic) - 2,000 coins - 3.0x rare fish boost, 25% success rate
- **Legendary Bait** (Legendary) - 5,000 coins - 5.0x rare fish boost, 15% success rate
- **Mythic Bait** (Mythic) - 10,000 coins - 7.0x rare fish boost, 10% success rate

#### How Fishing Rods Work
- **Permanent Items**: Fishing rods don't expire or need to be used
- **Best Rod Active**: Only the best fishing rod in your inventory provides cooldown reduction
- **Progressive Investment**: Higher-tier rods cost more but provide better cooldown reduction

#### How Bait Works
- **Consumable Items**: Bait is used up when applied and provides temporary effects
- **Success Rates**: Higher rarity bait has lower success rates for balance
- **Rare Fish Only**: Boost only applies to rare, epic, and legendary fish
- **Duration**: Bait effects last for 1 hour
- **Strategic Choice**: Players must decide between safe, reliable bait or risky, powerful bait

### 📦 Available Items

The shop offers various items that users can purchase with their coins:

#### 🎣 Fishing Items
- **Fish**: Various fish types with different rarities and sell prices
- **Fishing Rods**: Permanent items that reduce fishing cooldown
- **Bait**: Consumable items that boost rare fish catch rates with success rates

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
    variant TEXT,
    UNIQUE(user, guild, item_id, variant)
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
- **Fishing**: 18-30 minutes (based on best fishing rod)
- **Transfer**: No cooldown (limited by balance)
- **Deposit/Withdraw**: No cooldown (limited by available funds)
- **Item Usage**: Varies by item type
- **Shop Purchases**: Limited by item max quantities

## Economy Balance

The system is designed to maintain a healthy economy:

- **Daily Reward**: 100 coins (4,200 coins per week)
- **Work**: 10-50 coins per hour (70-350 coins per week)
- **Fishing**: Variable based on fish caught (5-500 coins per fish, 18-30 minute cooldown based on rod)
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
3. **Buy fishing rods** - Reduce fishing cooldown for more frequent fishing
4. **Buy bait** - Boost rare fish chances with strategic risk vs reward
5. **Buy mystery boxes** - Gamble for rare items
6. **Invest in daily doublers** - Double your income

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