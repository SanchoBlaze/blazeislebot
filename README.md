# Blaze Isle Bot

A feature-rich Node.js Discord bot for the Blaze Isle community, built with discord.js v14.

## Features
- **Modal-based configuration system** for easy server setup
- Rules acceptance with ✅ reaction to gain access
- **Configurable welcome messages** sent to designated channel
- **Advanced Twitch stream notifications** with real-time monitoring
- **Comprehensive loyalty/XP system** with leaderboard
- Fun commands: games (Connect4, TicTacToe, RPS, RPSLS), 8ball, dadjoke, gif, and more
- Animal facts and images (cat, dog, fox, bunny, duck)
- Action commands (hug, comfort)
- Info commands (server, avatar, help)
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

### Easy Configuration with Modals
Once the bot is running and has been invited to a new server, an Administrator must configure it using the **new modal-based `/config` command**. This provides an intuitive interface for setting up all bot features.

#### Configuration Commands
- `/config view` - Displays the current settings for the server
- `/config set` - Opens an interactive interface with buttons for each setting

#### Interactive Setup Process
1. Run `/config set` to see all available configuration options
2. Click the button for the setting you want to configure
3. A modal will appear with clear instructions and input validation
4. Enter the channel name, role name, or ID - the bot accepts multiple formats:
   - **Channel IDs:** `123456789012345678`
   - **Channel names:** `general` or `#general`
   - **Role IDs:** `123456789012345678` 
   - **Role names:** `Moderator` or `@Moderator`

#### Required Settings
- **📋 Rules Channel**: The channel where your rules message is posted
- **📝 Rules Message ID**: The ID of the message that users must react to with ✅
- **👥 Members Role**: The role granted to users after they accept the rules
- **📺 Streams Channel**: The channel where Twitch stream notifications will be posted
- **🛡️ Mod Role**: The role that has permission to use moderation commands
- **👋 Welcome Channel**: The channel where welcome messages are sent

## Advanced Features

### Twitch Stream Notifications
The bot features a comprehensive Twitch integration system with real-time monitoring:

#### Management Commands (Mod/Admin only)
- `/twitch add <username>` - Subscribe to a Twitch channel for notifications
- `/twitch remove <username>` - Unsubscribe from a Twitch channel  
- `/twitch list` - List all subscribed channels with who added them
- `/twitch status <username>` - Check a channel's current live status

#### Features
- **Real-time monitoring**: Checks streams every 5 minutes
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

### Loyalty/XP System
- **Automatic XP gain**: Users earn XP by being active in the server
- **Level progression**: XP converts to levels with a scaling formula
- **Leaderboard**: `/leaderboard` shows top users by XP
- **User stats**: `/xp` and `/level` commands show individual progress
- **Persistent storage**: All data stored in SQLite database

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
- Easy to extend with new commands and features
- Clean separation of concerns and error handling

## Join Us
Want to see the bot in action or join the Blaze Isle community?
[Join our Discord server!](https://discord.gg/ztBrtkHkwd)

---

*This bot is under active development. Contributions and suggestions are welcome!*

