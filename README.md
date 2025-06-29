# Blaze Isle Bot

A feature-rich Node.js Discord bot for the Blaze Isle community, built with discord.js v14.

## Features
- **Modal-based configuration system** with intelligent validation
- **Automatic owner notifications** when configuration is needed
- **Crash-proof operation** with graceful fallbacks for missing settings
- Rules acceptance with ✅ reaction to gain access
- **Configurable welcome messages** sent to designated channel
- **Advanced Twitch stream notifications** with real-time monitoring
- **Advanced loyalty/XP system** with scaled leveling and multi-level progression
- **Engaging games**: Connect4, TicTacToe, RPS, RPSLS with XP rewards for winners
- **Animal commands**: Cute pictures with small XP rewards (cat, dog, fox, bunny, duck)
- **Social commands**: Hug and comfort other users for XP and community building
- **Utility commands**: 8ball, dadjoke, gif, server info, avatar, and help
- **Role-based permissions** for moderation commands
- Modular command structure for easy extension

## Getting Started

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
- `twitch_subscriptions`: Twitch channel subscriptions
- `twitch_status`: Current stream status cache

### Modular Architecture
- Commands organized by category in `/commands/` subdirectories
- Separate modules for loyalty, Twitch, colors, and database operations
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

