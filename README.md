# Blaze Isle Bot

A feature-rich Discord bot with modular architecture, economy system, loyalty tracking, Twitch integration, and more.

## Features
- **Modal-based configuration system** with intelligent validation
- **Automatic owner notifications** when configuration is needed
- **Crash-proof operation** with graceful fallbacks for missing settings
- Rules acceptance with ✅ reaction to gain access
- **Configurable welcome messages** sent to designated channel
- **Advanced Twitch stream notifications** with real-time monitoring
- **Advanced loyalty/XP system** with scaled leveling and multi-level progression
- **💰 Comprehensive economy system** with wallet/bank, daily rewards, work, transfers, and shop
- **🌾 Advanced farming system** with crop variants, watering cans, fertilisers, and growth acceleration
- **Mythic rarity support**: Mythic items (🌈, magenta) are now available in the shop and inventory, with full support in all rarity tables and admin commands.
- **Crop variants**: Crops like peppers, tomatoes, and carrots have multiple variants (e.g., red/yellow/green), tracked in the database with a `variant` field and displayed with the correct emoji and name in inventory, harvest, and sell commands.
- **Watering cans**: All types (wood, copper, silver, gold, diamond, mythic) are available, each with increasing rarity and growth acceleration effect. Only the best can in your inventory is used for crop growth.
- **Fertilisers**: Six types of fertilisers (basic, premium, organic, magical, legendary, mythic) that increase crop yield with rarity-based success rates. Higher rarity crops have lower success rates, making fertilisers more effective on common crops.
- **Accurate staged growth system**: Crop growth times are now based on a staged system (e.g., common crops take 26 minutes, legendary 58 minutes, with each stage having a specific duration).
- **/farm info command**: Shows detailed information about each plot, including what is planted, stage, and time left to fully grow.
- **Sell confirmation**: When selling items (including via "Sell Quantity"), you now receive a confirmation message.
- **Buy Quantity**: The shop now features a "Buy Quantity" modal for bulk purchases, similar to the sell quantity functionality.
- **Command structure**: Farming commands are `/farm view` (interactive UI) and `/leaderboard farm` (top farmers). Removed references to `/farm plant` and `/farm harvest`.
- **Documentation**: See `FARMING_README.md` and `ECONOMY_README.md` for full details on farming, inventory, and item mechanics.
- **Engaging games**: Connect4, TicTacToe, RPS, RPSLS with XP rewards for winners
- **Animal commands**: Cute pictures with small XP rewards (cat, dog, fox, bunny, duck)
- **Social commands**: Hug and comfort other users for XP and community building
- **Utility commands**: 8ball, dadjoke, gif, server info, avatar, and help
- **Role-based permissions** for moderation commands
- Modular command structure for easy extension
- **Interactive paginator UI** for `/shop`, `/sell`, and `/use` commands: One item per page, navigation arrows, filter dropdown, action button, and emoji thumbnails for a modern, user-friendly experience.
- **Improved error handling and global interaction logic** for all interactive commands: No more failed interactions or double reply errors.
- **Scratch Card item**: A consumable with gambling logic—win coins or a random item, with the reward's emoji shown as the embed thumbnail.
- **Profit margin logic for item pricing**: All shop items are priced so users always make a profit when using or selling them.
- **Admin command stability**: All admin commands now handle Discord interactions robustly, preventing double reply errors.
- **Weeds crop and mechanic**: Weeds can now grow on empty plots (5% chance per hour per plot). Weeds are a harvestable crop with their own emoji and are managed like other crops.
- **Emoji config requirement**: Whenever you add a new item to data/default-items.json, you must also add a corresponding entry to config/emoji-configs.json with the correct emoji (Unicode or custom).

## Getting Started

### Option 1: Add the Bot to Your Server
Click the link below to add Blaze Isle Bot to your Discord server:
**[Add Blaze Isle Bot to Discord](https://discord.com/oauth2/authorize?client_id=712264446827036672)**

After adding the bot, run `/config set` to configure the basic settings for your server. The bot will then be ready to use with all features enabled.

### Option 2: Run Your Own Instance
If you prefer to host your own instance of the bot, follow the installation and setup instructions below.

### Prerequisites
- Node.js (v22.16.0 or higher)
- npm
- A Discord bot token ([How to create a bot](https://discordjs.guide/preparations/setting-up-a-bot-application.html))
- Twitch API credentials (for stream notifications)

### Setup
1. Clone the repository:
   ```bash
   git clone git@github.com:SanchoBlaze/blazeislebot.git
   cd BlazeIsleBot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `config/sample.json` to `config/default.json` and fill in your bot token and other required values.
4. **For Twitch integration:**
   - Get your Twitch Client ID and Secret from [Twitch Developer Console](https://dev.twitch.tv/console)
   - Add them to your config file
5. **Deploy slash commands** (see Command Management section below):
   ```bash
   # For testing (guild commands update immediately):
   npm run deploy:guild
   
   # For production (global commands take up to 1 hour):
   npm run deploy:global
   ```
6. Start the bot:
   To run the bot in a production environment, it is recommended to use PM2, a process manager for Node.js applications.
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Start the bot
   npm start
   
   # To view logs with timestamps
   pm2 logs BlazeIsleBot
   
   # To stop the bot
   npm stop
   ```

### Command Management
- **Deploy global commands:** `npm run deploy:global` or `node deploy-commands.js global`
- **Deploy guild commands:** `npm run deploy:guild` or `node deploy-commands.js guild`
- **Remove global commands:** `npm run remove:global` or `node remove-commands.js global`
- **Remove guild commands:** `npm run remove:guild` or `node remove-commands.js guild`

**Note:** Global commands can take up to 1 hour to update across all servers, while guild commands update immediately.

## Guild Setup

### Automatic Setup Guidance
When the bot joins your server, **the server owner automatically receives a welcome DM** with complete setup instructions. No more guessing what needs to be configured!

### Easy Configuration with Modals
The bot uses an **intelligent configuration system** that prevents crashes and guides you through setup. The **modal-based `/config` command** provides an intuitive interface for setting up all bot features with built-in validation.

#### Configuration Commands
- `/config view` - Displays the current settings for the server
- `/config set` - Opens an interactive interface with buttons for each setting

#### Interactive Setup Process
1. Run `/config set` to see all available configuration options
2. Click the button for the setting you want to configure
3. A modal will appear with clear instructions and input validation
4. Enter the ID:
   - **Channel IDs:** `123456789012345678`
   - **Role IDs:** `123456789012345678` 
 

#### Required Settings
- **📋 Rules Channel**: The channel where your rules message is posted
- **📝 Rules Message ID**: The ID of the message that users must react to with ✅
- **👥 Members Role**: The role granted to users after they accept the rules
- **📺 Streams Channel**: The channel where Twitch stream notifications will be posted
- **🛡️ Mod Role**: The role that has permission to use moderation commands
- **👋 Welcome Channel**: The channel where welcome messages are sent
- **🎉 Loyalty Channel**: The channel where level-up notifications are sent (optional - falls back to welcome channel)

### Smart Configuration Validation
The bot features an **intelligent configuration system** that ensures stability and user experience:

#### Automatic Validation
- **Real-time checks**: All features validate their configuration before executing
- **Graceful fallbacks**: Missing configuration won't crash the bot or spam errors
- **Feature-specific validation**: Each feature only requires its relevant settings

#### Owner Notifications
- **Welcome DM**: New server owners receive comprehensive setup instructions
- **Missing config alerts**: Owners are notified when users try to use unconfigured features
- **Anti-spam protection**: Each notification is sent only once per feature
- **Clear guidance**: Rich embeds explain exactly what's missing and how to fix it

#### User Experience
- **Helpful error messages**: Users get clear feedback when features aren't configured
- **No crashes**: Bot continues working even with partial configuration
- **Professional presentation**: All notifications are well-formatted and informative

## Advanced Features

### Twitch Stream Notifications
The bot features a comprehensive Twitch integration system with real-time monitoring:

#### Management Commands (Mod/Admin only)
- `/twitch add <username>` - Subscribe to a Twitch channel for notifications
- `/twitch remove <username>` - Unsubscribe from a Twitch channel  
- `/twitch list` - List all subscribed channels with who added them
- `/twitch status <username>` - Check a channel's current live status

#### Features
- **Real-time monitoring**: Checks streams every 1 minutes
- **Smart notifications**: Only notifies when streams go from offline to live
- **Rich embeds**: Stream notifications include title, game, viewer count, and thumbnail
- **Database persistence**: All subscriptions and stream states are stored in SQLite
- **OAuth2 integration**: Uses proper Twitch API authentication
- **Error handling**: Robust error handling for API failures and missing channels

### Rules & Welcome System
- **Automated role assignment**: Users get the Members role when they react with ✅ to the rules
- **Welcome messages**: Sent to the configured welcome channel (not hardcoded to #general)
- **Loyalty system integration**: New members are automatically added to the XP system
- **DM notifications**: Users receive a private message confirming rule acceptance

### Advanced Loyalty/XP System
The bot features a sophisticated leveling system designed to reward active community members:

#### Scaled Leveling Formula
- **Exponential progression**: Level requirements scale with formula `level^2.5 * 100`
- **Progressive difficulty**: Level 0 starts at 0 XP, Level 1 needs 100 XP, Level 2 needs 566 XP, Level 3 needs 1,548 XP
- **Multi-level jumping**: Users can gain multiple levels from large XP amounts
- **Efficient calculation**: Uses binary search algorithm for optimal performance

#### XP Sources & Rewards
- **Chat activity**: 1 XP per message for participating in conversations
- **Game victories**: 10-50 XP for winning games (RPS: 10 XP, TicTacToe/Connect4: 50 XP)
- **Social interactions**: 25 XP for hug and comfort commands
- **Animal commands**: 3 XP for cute animal picture commands (cat, dog, fox, bunny, duck)

#### Level Categories & Badges
- **🥚 Starting** (Level 0): Brand new members (0-99 XP)
- **🌱 Newcomer** (Levels 1-4): New community members
- **🥉 Bronze** (Levels 5-14): Regular participants  
- **🥈 Silver** (Levels 15-29): Active community members
- **🏆 Gold** (Levels 30-49): Dedicated contributors
- **💎 Diamond** (Levels 50+): Elite community champions

#### Commands & Features
- **`/xp [user]`**: View your XP and progress with visual progress bar
- **`/level [user]`**: See detailed level information and category badge
- **`/leaderboard`**: Top 10 users with XP, levels, and badges
- **Level-up notifications**: Automatic announcements in dedicated loyalty channel (or welcome channel as fallback)
- **Rich embeds**: Beautiful displays with progress bars and statistics
- **Persistent storage**: All data safely stored in SQLite database

### 💰 Economy System
The bot features a complete virtual economy system that encourages community engagement and provides users with meaningful progression:

#### Currency & Banking
- **Dual currency system**: Wallet for spending, bank for savings
- **Net worth tracking**: Combined wallet and bank balance
- **Transaction history**: Complete audit trail of all economic activities
- **Secure transfers**: User-to-user coin transfers with validation

#### Earning Methods
- **Daily rewards**: 100 coins every 24 hours (`/daily`)
- **Work system**: 10-50 coins every hour (`/work`)
- **Fishing system**: Catch fish to sell (prices vary by rarity, 30-minute cooldown)
- **Admin rewards**: Server administrators can give coins

#### Banking Features
- **Deposit/Withdraw**: Move coins between wallet and bank
- **Transfer system**: Send coins to other users
- **Balance protection**: Users cannot go below 0 coins
- **Transaction logging**: All activities are recorded with timestamps

#### Economy Commands
- **`/balance [user]`**: Check wallet, bank, and net worth
- **`/daily`**: Claim daily reward (100 coins)
- **`/work`**: Work for coins (10-50 coins, 1 hour cooldown)
- **`/fish`**: Go fishing to catch fish (30-minute cooldown)
- **`/deposit <amount>`**: Move coins to bank
- **`/withdraw <amount>`**: Move coins from bank
- **`/transfer <user> <amount>`**: Send coins to another user
- **`/economy-leaderboard [limit]`**: Show richest users
- **`/history [user] [limit]`**: View transaction history
- **`/inventory [user]`**: View your or another user's inventory
- **`/use <item>`**: Use an item from your inventory
- **`/shop`**: Interactive shop with purchase buttons
- **`/sell`**: Sell items back to the shop
- **`/help-economy`**: Get help with economy commands

#### Admin Controls
- **`/economy-admin add <user> <amount>`**: Add coins to user
- **`/economy-admin remove <user> <amount>`**: Remove coins from user
- **`/economy-admin set <user> <amount>`**: Set user's balance
- **`/economy-admin stats`**: View server economy statistics

#### Shop System
- **Interactive buttons**: Click to purchase items
- **Inventory management**: Store and manage your items
- **Item rarity system**: Common, Uncommon, Rare, Epic, Legendary
- **Consumable items**: XP boosts, work multipliers, daily doublers
- **Fishing rods**: Permanent items that boost rare fish catch rates
- **Fish items**: Catchable fish with different rarities and sell prices
- **Mystery boxes**: Random item rewards
- **Item effects**: Temporary boosts and permanent rewards
- **Quantity limits**: Prevent hoarding with max quantities
- **Expiration system**: Time-limited items with automatic cleanup

#### Economy Balance
The system is designed to maintain a healthy economy:
- **Daily Reward**: 100 coins (4,200 coins per week)
- **Work**: 10-50 coins per hour (70-350 coins per week)
- **Total Weekly Potential**: ~4,200-4,550 coins for active users

📖 **[View detailed economy documentation →](ECONOMY_README.md)**

#### Interactive shop, sell, and use commands: Browse, buy, sell, and use items with a modern paginator UI, filter dropdown, and emoji thumbnails.
#### Scratch Card item: Try your luck for coins or rare items, with visual feedback for your reward.
#### Transparent profit margins: All item prices are set so users always make a profit.
#### Admin command stability: All admin commands now handle Discord interactions robustly, preventing double reply errors.

## 🏆 Net Worth XP Bonuses

- Users receive a one-time XP bonus for reaching certain net worth milestones (wallet + bank):
  - 10,000 coins: 250 XP
  - 50,000 coins: 750 XP
  - 100,000 coins: 1,500 XP
  - 250,000 coins: 3,000 XP
  - 500,000 coins: 6,000 XP
  - 1,000,000 coins: 12,000 XP
- Each bonus is awarded only once per user per threshold.
- When a user hits a milestone, a non-ephemeral notification is sent in the economy channel, showing the user's avatar and milestone details.

## Technical Details

### Built With
- **discord.js v14**: Latest Discord API wrapper with modern features
- **SQLite3**: Lightweight database for persistence
- **Node.js v22**: Latest LTS Node.js version
- **PM2**: Production process management
- **Twitch API**: Real-time stream data and OAuth2 authentication

### Database Schema
The bot uses SQLite with the following tables:
- `guild_settings`: Server-specific configuration
- `loyalty`: User XP and level data
- `economy`: User wallet, bank, and economy data
- `transactions`: Economy transaction history
- `inventory`: User item storage and quantities
- `items`: Item definitions, prices, and effects
- `twitch_subscriptions`: Twitch channel subscriptions
- `twitch_status`: Current stream status cache

### Modular Architecture
- Commands organized by category in `/commands/` subdirectories
- Separate modules for loyalty, Twitch, colours, and database operations
- **Configuration validation system** with feature-specific checks
- **Owner notification system** with anti-spam protection
- Easy to extend with new commands and features
- Clean separation of concerns and comprehensive error handling

### Reliability Features
- **Crash-proof operation**: All features validate configuration before executing
- **Graceful degradation**: Bot continues working with partial configuration
- **Automatic migrations**: Database schema updates are handled automatically
- **Comprehensive logging**: Detailed logs for debugging and monitoring
- **Error recovery**: Robust error handling throughout the codebase

## Troubleshooting

### Common Issues

#### "This server is not configured for [feature]"
This message appears when trying to use a feature that requires configuration. **The server owner has automatically been notified** with setup instructions.

**Solution:** Run `/config set` and configure the required settings for that feature.

#### Features Not Working
If bot features aren't working as expected:

1. **Check configuration**: Run `/config view` to see current settings
2. **Verify permissions**: Ensure the bot has necessary permissions in configured channels
3. **Check channels/roles**: Make sure configured channels and roles still exist
4. **Owner notification**: If settings are missing, the owner will receive a DM with guidance

#### Bot Joined But No Welcome Message
This is normal! The bot sends setup instructions via **DM to the server owner** instead of posting in channels. Check your DMs for the welcome message with configuration instructions.

### Getting Help
- **Join our Discord**: [Blaze Isle Community](https://discord.gg/ztBrtkHkwd)
- **Check logs**: The bot provides detailed console logs for debugging
- **Configuration guide**: All setup instructions are provided via DM when needed

## Join Us
Want to see the bot in action or join the Blaze Isle community?
[Join our Discord server!](https://discord.gg/ztBrtkHkwd)

---

*This bot is under active development. Contributions and suggestions are welcome!*

