# Farming System Documentation

## Overview

The Blaze Isle Bot features a comprehensive farming system that allows users to plant, grow, and harvest various crops with different variants. The system includes crop variants, watering cans for growth acceleration, and full integration with the economy and inventory systems.

## Features

### 🌱 Crop System
- **Planting**: Plant seeds to grow crops using the interactive `/farm` interface
- **Worm Discovery**: 15% chance to find worms when planting seeds, rewarding you with 1-3 Basic Bait
- **Growth Times**: Each crop has a base growth time that can be reduced with watering cans
- **Harvesting**: Collect fully grown crops using the interactive `/farm` interface
- **Crop Variants**: Many crops have multiple variants (e.g., red, yellow, green peppers)
- **Visual Feedback**: See your farm plot with current crop status and growth progress

### 🪣 Watering Cans
Watering cans are permanent items that reduce crop growth times, similar to fishing rods:

#### Available Watering Cans
| Watering Can | Rarity | Emoji | Effect Value | Growth Multiplier | Price |
|--------------|--------|-------|--------------|-------------------|-------|
| **Wood** | Common | 🪣 | 0.95 | 0.95x (5% faster) | 500 coins |
| **Copper** | Uncommon | 🪣 | 0.9 | 0.9x (10% faster) | 2,000 coins |
| **Silver** | Rare | 🪣 | 0.85 | 0.85x (15% faster) | 8,000 coins |
| **Gold** | Epic | 🪣 | 0.8 | 0.8x (20% faster) | 25,000 coins |
| **Diamond** | Legendary | 💎 | 0.7 | 0.7x (30% faster) | 75,000 coins |
| **Mythic** | Mythic | 🌈 | 0.6 | 0.6x (40% faster) | 200,000 coins |

#### How Watering Cans Work
- **Permanent Items**: Watering cans don't expire or need to be used
- **Best Can Active**: Only the best watering can in your inventory provides the boost
- **Growth Time Reduction**: The multiplier is applied to all crop growth times
- **Effect Value**: Lower values provide better boosts (0.1 = 90% faster growth)

### 💩 Fertilisers
Fertilisers are consumable items that increase crop yield when applied during planting. The chance of success decreases as seed rarity increases:

#### Available Fertilisers
| Fertilizer | Rarity | Emoji | Effect Value | Yield Boost | Price |
|------------|--------|-------|--------------|-------------|-------|
| **Basic** | Common | 💩 | 5 | 5% boost | 100 coins |
| **Premium** | Uncommon | 🌱 | 10 | 10% boost | 300 coins |
| **Organic** | Rare | 🍃 | 20 | 20% boost | 800 coins |
| **Magical** | Epic | ✨ | 30 | 30% boost | 2,000 coins |
| **Legendary** | Legendary | 🌟 | 40 | 40% boost | 5,000 coins |
| **Mythic** | Mythic | 🌈 | 50 | 50% boost | 15,000 coins |

#### How Fertilisers Work
- **Consumable Items**: Fertilisers are consumed when applied to a plot
- **Rarity-Based Success**: Higher rarity crops have lower success rates
- **Yield Boost**: Successful application adds extra yield based on fertiliser quality
- **Optional Application**: Fertilisers are optional during the planting process

#### Fertilisers Success Rates by Crop Rarity
| Crop Rarity | Success Rate | Description |
|-------------|--------------|-------------|
| **Common** | 80% | High chance of success on basic crops |
| **Uncommon** | 60% | Good chance on standard crops |
| **Rare** | 40% | Moderate chance on premium crops |
| **Epic** | 25% | Low chance on high-value crops |
| **Legendary** | 15% | Very low chance on rare specialty crops |

#### Fertilisers Application Process
1. **Plant Seed**: Select a seed to plant
2. **Choose Plot**: Pick an empty plot (1-9, 1-16, 1-25, or 1-36 depending on farm size)
3. **Apply Fertilisers**: Optionally select fertiliser from inventory
4. **Automatic Application**: Fertilisers is consumed and applied to the plot
5. **Harvest Results**: Increased yield if fertiliser was successful

### 🪱 Worm Discovery
When planting seeds, there's a 15% chance you'll discover a worm in the soil! This exciting discovery rewards you with 1-3 Basic Bait items, which are perfect for fishing. The worm discovery appears as a separate ephemeral message with the worm image as the thumbnail.

### 🍅 Crop Variants
Many crops have multiple variants that provide different visual experiences and inventory management:

#### Variant System
- **Unique Items**: Each variant is treated as a separate item in inventory
- **Visual Distinction**: Different emojis and names for each variant
- **Deduped Display**: Inventory and sell commands group variants together
- **Database Storage**: Variants are stored with a `variant` field in the database

#### Example Crop Variants
- **Peppers**: Red Pepper 🌶️, Yellow Pepper 🫑, Green Pepper 🫑
- **Tomatoes**: Red Tomato 🍅, Yellow Tomato 🍅, Green Tomato 🍅
- **Carrots**: Orange Carrot 🥕, Purple Carrot 🥕, White Carrot 🥕

### ⏱️ Growth Times

#### Base Growth Times by Rarity
| Rarity | Total Time | Stage Times | Description |
|--------|------------|-------------|-------------|
| **Common** | 26 minutes | 5m + 6m + 7m + 8m | Quick-growing basic crops |
| **Uncommon** | 34 minutes | 7m + 8m + 9m + 10m | Standard crops |
| **Rare** | 42 minutes | 9m + 10m + 11m + 12m | Premium crops |
| **Epic** | 50 minutes | 11m + 12m + 13m + 14m | High-value crops |
| **Legendary** | 58 minutes | 13m + 14m + 15m + 16m | Rare specialty crops |

#### Total Growth Times with Watering Cans
| Crop Rarity | No Can | Wood | Copper | Silver | Gold | Diamond | Mythic |
|-------------|--------|------|--------|--------|------|---------|--------|
| **Common** | 26m | 24.7m | 23.4m | 22.1m | 20.8m | 18.2m | 15.6m |
| **Uncommon** | 34m | 32.3m | 30.6m | 28.9m | 27.2m | 23.8m | 20.4m |
| **Rare** | 42m | 39.9m | 37.8m | 35.7m | 33.6m | 29.4m | 25.2m |
| **Epic** | 50m | 47.5m | 45m | 42.5m | 40m | 35m | 30m |
| **Legendary** | 58m | 55.1m | 52.2m | 49.3m | 46.4m | 40.6m | 34.8m |

### 📦 Inventory Integration
The farming system fully integrates with the economy and inventory systems:

#### Harvested Crops
- **Automatic Storage**: Harvested crops are automatically added to your inventory
- **Variant Support**: Each crop variant is stored separately with proper emoji and name
- **Sell System**: Crops can be sold back to the shop with rarity-based pricing
- **Quantity Tracking**: Multiple harvests of the same crop/variant stack in inventory

#### Watering Cans
- **Permanent Items**: Watering cans are permanent items that don't expire
- **Best Can Logic**: The system automatically uses your best watering can
- **Shop Integration**: Watering cans can be purchased from the shop
- **Inventory Display**: Watering cans appear in inventory with rarity indicators

### 🎯 Earning Methods
- **Crop Sales**: Sell harvested crops for coins (rarity-based pricing)
- **Variant Premium**: Some variants may have different sell prices
- **Efficient Farming**: Watering cans allow for faster crop cycles and more profit

### 🏡 Farm Upgrades
Expand your farming operation with farm size upgrades that unlock more plots for increased crop production:

#### Available Farm Upgrades
| Upgrade | Rarity | Emoji | Plots | Price | Description |
|---------|--------|-------|-------|-------|-------------|
| **4x4 Farm Upgrade** | Epic | 🏡 | 16 plots | 50,000 coins | Unlocks a 4x4 (16 plot) farm |
| **5x5 Farm Upgrade** | Legendary | 🏡 | 25 plots | 150,000 coins | Unlocks a 5x5 (25 plot) farm |
| **6x6 Farm Upgrade** | Mythic | 🏡 | 36 plots | 500,000 coins | Unlocks a 6x6 (36 plot) farm |

#### How Farm Upgrades Work
- **Permanent Upgrades**: Once purchased, farm upgrades are permanent and cannot be lost
- **Progressive Sizing**: Each upgrade provides more plots than the previous tier
- **Shop Category**: Farm upgrades are available in the "Farm Upgrades" shop category
- **Sell Protection**: Upgrades cannot be sold back to the shop (protected items)
- **Visual Scaling**: Farm images automatically scale to show the correct number of plots
- **Plot Coordinates**: Each upgrade has precisely positioned plot coordinates for optimal layout

#### Farm Size Progression
- **Default**: 3x3 farm (9 plots) - Available to all users
- **4x4**: 16 plots - Epic upgrade for serious farmers
- **5x5**: 25 plots - Legendary upgrade for farming enthusiasts  
- **6x6**: 36 plots - Mythic upgrade for the ultimate farming experience

#### Upgrade Benefits
- **Increased Production**: More plots = more crops = higher profits
- **Efficiency**: Plant multiple crops simultaneously for better time management
- **Variety**: Grow different crops across more plots for diverse harvests
- **Investment**: Higher-tier upgrades provide better long-term returns

## Commands

### 🌾 Farming Commands
- `/farm view` - Interactive farming interface with buttons for planting, harvesting, farm management, and viewing plot info
- `/farm info` - View detailed information about each plot (what is planted, stage, time left to fully grow, and applied fertilisers)
- `/leaderboard farm` - View top users by crops harvested

### 📦 Related Commands
- `/inventory [user]` - View your or another user's inventory (shows crops and watering cans)
- `/sell` - Sell harvested crops and other items back to the shop
- `/shop` - Purchase seeds, watering cans, and other farming supplies

### 🎮 Interactive Farming Interface

The `/farm view` command provides a complete interactive farming experience:

#### 🌱 Planting Process
1. **Click "🌱 Plant Seed"** - Opens seed and plot selection menus
2. **Select a Seed** - Choose from seeds in your inventory
3. **Select a Plot** - Pick an empty plot (1-9, 1-16, 1-25, or 1-36 depending on farm size) to plant in
4. **Apply Fertilisers** - Optionally select fertiliser from inventory (optional step)
5. **Automatic Planting** - Seed and fertiliser (if selected) are consumed and crop begins growing

#### 🌾 Harvesting Process
1. **Click "🌾 Harvest All"** - Automatically harvests all ready crops
2. **Crops Added to Inventory** - Harvested crops go directly to your inventory
3. **Fertilisers Effects** - Crops with successful fertiliser application show fertiliser emoji
4. **Variant Selection** - Crops with variants get random variants when harvested
5. **Plot Clearing** - Harvested plots become available for new crops

#### 🔄 Farm Management
- **Refresh** - Updates the farm display to show current growth progress
- **Share** - Posts your farm image to the channel for others to see
- **Visual Progress** - See crops grow through 4 stages with visual indicators

### 🛠️ Admin Commands
- `/economy-admin add-item` - Add custom crops or farming items
- `/economy-admin populate-defaults` - Add default farming items to the shop

## Crop Types

### 🌾 Available Crops
The farming system includes a variety of crops across different rarities:

#### Common Crops (26 minutes total)
- **Wheat** 🌾 - Basic grain crop
- **Corn** 🌽 - Versatile grain
- **Potato** 🥔 - Staple root vegetable

#### Uncommon Crops (34 minutes total)
- **Tomato** 🍅 - Popular vegetable (Red, Yellow, Green variants)
- **Carrot** 🥕 - Root vegetable (Orange, Purple, White variants)
- **Lettuce** 🥬 - Leafy green

#### Rare Crops (42 minutes total)
- **Pepper** 🌶️ - Spicy vegetable (Red, Yellow, Green variants)
- **Strawberry** 🍓 - Sweet berry
- **Blueberry** 🫐 - Antioxidant-rich berry

#### Epic Crops (50 minutes total)
- **Pineapple** 🍍 - Tropical fruit
- **Mango** 🥭 - Sweet tropical fruit
- **Dragon Fruit** 🐉 - Exotic fruit

#### Legendary Crops (58 minutes total)
- **Golden Apple** 🍎 - Magical fruit
- **Crystal Berry** 💎 - Rare crystalline fruit
- **Mythic Mushroom** 🍄 - Enchanted fungus

## Economy Integration

### 💰 Selling Crops
- **Rarity-Based Pricing**: Rarer crops sell for higher prices
- **Variant Pricing**: Some variants may have premium pricing
- **Profit Margins**: All crops are priced to ensure profitable farming
- **Bulk Sales**: Sell multiple crops at once through the interactive sell system

### 🛒 Purchasing Supplies
- **Seeds**: Buy crop seeds from the shop
- **Watering Cans**: Invest in better watering cans for efficiency
- **Farming Tools**: Additional farming equipment may be available

## Tips for Efficient Farming

### 🚀 Maximizing Profits
1. **Invest in Watering Cans**: Better watering cans = faster growth = more profit cycles
2. **Plant High-Value Crops**: Focus on rare, epic, and legendary crops for better returns
3. **Manage Your Farm**: Harvest crops promptly to maximize plot usage
4. **Diversify**: Plant different crops to avoid market saturation

### ⚡ Growth Optimization
1. **Best Watering Can**: Always keep your best watering can in inventory
2. **Timing**: Plan your farming schedule around growth times
3. **Efficiency**: Use the fastest-growing crops for quick profits

### 📊 Inventory Management
1. **Variant Organization**: Keep track of different crop variants
2. **Selling Strategy**: Sell crops when prices are favorable
3. **Storage**: Use inventory space efficiently for farming supplies

## Weeds Crop & Growth Mechanic

- **Weeds** can grow on any empty plot with a 5% chance per hour (per plot).
- Weeds are a harvestable crop: when they appear, they are fully grown and can be harvested for a small reward.
- Weeds use their own emoji and are managed like other crops in inventory and the shop.
- The weed growth check only happens once per hour per user, so refreshing your farm does not spawn more weeds within the hour.
- **Emoji config requirement:** Whenever you add a new item to data/default-items.json, you must also add a corresponding entry to config/emoji-configs.json with the correct emoji (Unicode or custom).

## Technical Details

### 🗄️ Database Schema
- **Crops Table**: Stores planted crops with user, guild, crop type, variant, and planting time
- **Inventory Table**: Stores harvested crops with variant support
- **Unique Indexes**: Prevents duplicate crops and ensures proper variant handling

### 🔧 System Integration
- **Economy System**: Full integration with wallet, bank, and transaction tracking
- **Inventory System**: Seamless item storage and management
- **Shop System**: Farming items available through the interactive shop
- **Admin System**: Server administrators can add custom crops and items

### 🎨 Visual Features
- **Rich Embeds**: Beautiful displays for farm status and harvest results
- **Progress Indicators**: Visual feedback on crop growth progress
- **Emoji Integration**: Custom emojis for all crops and variants
- **Interactive UI**: Modern paginator interface for inventory and shop 

### 🐞 Bug Fixes & Improvements
- **Variant Harvest Bug Fixed**: Variants are now selected from the crop item, not the seed, ensuring correct variant assignment on harvest.
- **Sell Confirmation**: You now receive a confirmation message after selling items, including via "Sell Quantity". 