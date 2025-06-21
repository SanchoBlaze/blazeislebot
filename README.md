# Blaze Isle Bot

A feature-rich Node.js Discord bot for the Blaze Isle community.

## Features
- Rules acceptance with ✅ reaction to gain access
- Automated welcome messages after rules are accepted
- **Twitch stream notifications** for mods/admins
- Fun commands: games (Connect4, TicTacToe, RPS, RPSLS), 8ball, dadjoke, gif, and more
- Animal facts and images
- Loyalty/XP system with leaderboard
- Info commands (server, avatar, help)
- Modular command structure for easy extension

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
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
Once the bot is running and has been invited to a new server, an Administrator must configure it using the `/config` command. This is required for most features to work correctly.

- `/config view` - Displays the current settings for the server.
- `/config set <key> <value>` - Sets a specific configuration value. The value should be the ID of the channel, message, or role.

### Required Settings
- `rules_channel_id`: The channel where your rules message is.
- `rules_message_id`: The ID of the message that users must react to.
- `members_role_id`: The role to grant users after they accept the rules.
- `streams_channel_id`: The channel where Twitch stream notifications will be posted.
- `mod_role_id`: The role that has permission to use the `/twitch` command (in addition to Administrators).

## Twitch Stream Notifications
Moderators and admins can manage Twitch stream notifications using the `/twitch` command:

- `/twitch add <username>` - Subscribe to a Twitch channel
- `/twitch remove <username>` - Unsubscribe from a Twitch channel  
- `/twitch list` - List all subscribed channels
- `/twitch status <username>` - Check a channel's current status

The bot checks for live streams every 5 minutes and posts notifications to the configured streams channel.

## Join Us
Want to see the bot in action or join the Blaze Isle community?
[Join our Discord server!](https://discord.gg/ztBrtkHkwd)

---

*WIP: This bot is under active development. Contributions and suggestions are welcome!*

