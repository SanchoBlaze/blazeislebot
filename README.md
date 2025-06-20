# Blaze Isle Bot

A feature-rich Node.js Discord bot for the Blaze Isle community.

## Features
- Rules acceptance with ✅ reaction to gain access
- Automated welcome messages after rules are accepted
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
4. (Optional) Deploy slash commands:
   ```bash
   node deploy-commands.js
   ```
5. Start the bot:
   ```bash
   node blazeislebot.js
   ```

## Configuration
- All configuration is handled in `config/default.json` (not tracked by git).
- Set your Discord bot token, rules channel/message IDs, and Members role ID as described in the config file.

## Join Us
Want to see the bot in action or join the Blaze Isle community?
[Join our Discord server!](https://discord.gg/ztBrtkHkwd)

---

*WIP: This bot is under active development. Contributions and suggestions are welcome!*

