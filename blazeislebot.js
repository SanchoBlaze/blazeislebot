'use strict';

/**
 * A bot for the Blaze Isle Discord server.
 */

const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder } = require('discord.js');
const config = require('config');
const fs = require('fs');
const Colours = require('./modules/colours');
const Loyalty = require('./modules/loyalty');


// Create an instance of a Discord client
const client = new Client({
    partials: [Partials.Channel],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ]
});


client.commands = new Collection();
client.cooldowns = new Collection();

const loyalty = new Loyalty();
client.loyalty = loyalty;


const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        command.category = folder;
        client.commands.set(command.data.name, command);
    }
}


client.once('ready', () => {
    console.log('Blaze Isle Bot Online!');
});


client.on('guildMemberAdd', (member) => {
    // Do not send welcome message here; wait until rules are accepted
    // client.loyalty.addUser will also be called after rules acceptance
});

client.on('interactionCreate', async interaction => {

    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    if (command.guildOnly && interaction.channel.type === 1) { // 1 = DM in v14
        return interaction.reply('I can\'t execute that command inside DMs!');
    }

    if (command.role) {
        if (!interaction.member.roles.cache.some(role => role.name === command.role)) {
            return interaction.reply('You can not do this!');
        }
    }

    if (interaction.user.bot) return;


    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    // Only proceed if the reaction is in the rules channel and on the rules message
    if (
        reaction.message.channel.id === config.get('rulesChannelId') &&
        reaction.message.id === config.get('rulesMessageId') &&
        (reaction.emoji.name === '✅' || reaction.emoji.id === 'white_check_mark')
    ) {
        const guild = reaction.message.guild;
        if (!guild) return;
        const member = await guild.members.fetch(user.id);
        const roleId = config.get('membersRoleId');
        if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId, 'Accepted rules');
            // Send welcome message in #general
            const channel = guild.channels.cache.find(ch => ch.name === 'general');
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(`Welcome to **${guild}**`)
                    .setDescription(`Hey ${user.toString()}, thanks for joining!`)
                    .setColor(Colours.WELCOME_GREEN)
                    .setThumbnail(user.displayAvatarURL());
                channel.send({ embeds: [embed] });
            }
            // Add user to loyalty system
            client.loyalty.addUser(user, guild);
            try {
                await user.send(`You have accepted the rules and have been given the Members role in **${guild.name}**. Welcome!`);
            } catch (e) {
                // Ignore if DM fails
            }
        }
    }
});

client.login(config.get('Discord.token'));