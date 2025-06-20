const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require('config');

// Get client and guild ids from config
const clientId = config.get('Discord.clientId');
const guildId = config.get('Discord.guildId');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (!command || (command !== 'global' && command !== 'guild')) {
    console.log('Usage: node remove-commands.js <global|guild>');
    console.log('  global - Remove all global application commands');
    console.log('  guild  - Remove all guild-specific commands');
    process.exit(1);
}

const rest = new REST({ version: '9' }).setToken(config.get('Discord.token'));

async function removeCommands() {
    try {
        if (command === 'global') {
            console.log('Removing all global application commands...');
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('✅ Successfully removed all global application commands.');
        } else if (command === 'guild') {
            console.log('Removing all guild-specific commands...');
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('✅ Successfully removed all guild-specific commands.');
        }
    } catch (error) {
        console.error('❌ Error removing commands:', error);
        process.exit(1);
    }
}

removeCommands(); 