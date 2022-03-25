const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require('config');

// Invite link https://discord.com/api/oauth2/authorize?client_id=712264446827036672&permissions=0&scope=bot%20applications.commands
// Place your client and guild ids here
const clientId = '712264446827036672';
const guildId = '836628120224268328';

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

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);