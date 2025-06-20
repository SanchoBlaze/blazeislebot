const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require('config');

// Invite link https://discord.com/api/oauth2/authorize?client_id=712264446827036672&permissions=8&scope=bot%20applications.commands
// Get client and guild ids from config
const clientId = config.get('Discord.clientId');
const guildId = config.get('Discord.guildId');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (!command || (command !== 'global' && command !== 'guild')) {
    console.log('Usage: node deploy-commands.js <global|guild>');
    console.log('  global - Deploy commands globally (takes up to 1 hour to update)');
    console.log('  guild  - Deploy commands to guild (updates immediately)');
    process.exit(1);
}

const commands = [];
const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    if(folder != 'utility') {
        const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${file}`);
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST({ version: '9' }).setToken(config.get('Discord.token'));

async function deployCommands() {
    try {
        if (command === 'global') {
            console.log('Deploying commands globally...');
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log('✅ Successfully registered application commands globally.');
            console.log('⚠️  Note: Global commands can take up to 1 hour to update across all servers.');
        } else if (command === 'guild') {
            console.log('Deploying commands to guild...');
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log('✅ Successfully registered application commands to guild.');
            console.log('✅ Commands are available immediately.');
        }
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
}

deployCommands();