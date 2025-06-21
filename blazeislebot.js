'use strict';

/**
 * A bot for the Blaze Isle Discord server.
 */

const fs = require('fs');
const config = require('config');
const dns = require('dns');

// Set custom DNS servers if configured
try {
    const dnsServers = config.get('DNS.servers');
    if (dnsServers && Array.isArray(dnsServers) && dnsServers.length > 0) {
        dns.setServers(dnsServers);
        console.log(`Custom DNS servers set: ${dnsServers.join(', ')}`);
    }
} catch (e) {
    // DNS config does not exist, do nothing.
}

const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder } = require('discord.js');
const Colours = require('./modules/colours');
const Loyalty = require('./modules/loyalty');
const TwitchManager = require('./modules/twitch');


// Create an instance of a Discord client
const client = new Client({
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
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
const twitchManager = new TwitchManager();
client.loyalty = loyalty;
client.twitch = twitchManager;


const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        if (command.disabled) continue;
        command.category = folder;
        client.commands.set(command.data.name, command);
    }
}


client.once('ready', () => {
    console.log('Blaze Isle Bot Online!');
    
    // Start Twitch stream checking
    startTwitchChecker();
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

    // Handle partials
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Error fetching message:', error);
            return;
        }
    }

    // Only proceed if the reaction is in the rules channel and on the rules message
    if (
        reaction.message.channel.id === config.get('rulesChannelId') &&
        reaction.message.id === config.get('rulesMessageId') &&
        reaction.emoji.name === '✅'
    ) {
        const guild = reaction.message.guild;
        if (!guild) return;
        const member = await guild.members.fetch(user.id);
        const roleId = config.get('membersRoleId');
        if (!member.roles.cache.has(roleId)) {
            try {
                await member.roles.add(roleId, 'Accepted rules');
            } catch (err) {
                console.error(`Failed to add Members role to ${user.tag} (${user.id}):`, err);
            }
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

// Twitch stream checker
function startTwitchChecker() {
    // Check if Twitch credentials are configured
    const clientId = config.get('Twitch.client_id');
    const clientSecret = config.get('Twitch.secret');
    
    if (!clientId || !clientSecret) {
        console.log('Twitch credentials not configured - Twitch stream checking disabled');
        return;
    }
    
    console.log('Starting Twitch stream checker...');
    
    setInterval(async () => {
        try {
            const subscriptions = await twitchManager.getAllSubscriptions();
            
            if (subscriptions.length === 0) {
                return; // No subscriptions to check
            }
            
            for (const username of subscriptions) {
                const currentStatus = await twitchManager.getStreamStatus(username);
                const newStatus = await twitchManager.checkStreamStatus(username);
                
                // Update status in database
                await twitchManager.updateStreamStatus(username, newStatus);
                
                // Check if stream just went live
                if (newStatus && (!currentStatus || !currentStatus.is_live)) {
                    await sendStreamNotification(username, newStatus);
                }
            }
        } catch (error) {
            console.error('Error in Twitch checker:', error);
        }
    }, 1 * 60 * 1000); // Check every 5 minutes
}

async function sendStreamNotification(twitchUsername, streamData) {
    try {
        const streamsChannelId = config.get('streamsChannelId');
        if (!streamsChannelId) {
            console.error('streamsChannelId not configured');
            return;
        }

        const subscriptions = await twitchManager.getSubscriptionsForUser(twitchUsername);
        
        for (const subscription of subscriptions) {
            const guild = client.guilds.cache.get(subscription.guild_id);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(streamsChannelId);
            if (!channel) {
                console.error(`Streams channel not found in guild ${guild.name}`);
                continue;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔴 LIVE NOW!')
                .setDescription(`**${twitchUsername}** is now live on Twitch!`)
                .addFields(
                    { name: 'Title', value: streamData.title || 'No title', inline: true },
                    { name: 'Game', value: streamData.game_name || 'No game', inline: true },
                    { name: 'Viewers', value: streamData.viewer_count?.toString() || 'Unknown', inline: true }
                )
                .setColor(Colours.RED)
                .setTimestamp()
                .setURL(`https://twitch.tv/${twitchUsername}`)
                .setThumbnail(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${twitchUsername}-320x180.jpg`);
            
            await channel.send({ 
                content: `🎉 **${twitchUsername}** is now live! <https://twitch.tv/${twitchUsername}>`,
                embeds: [embed] 
            });
        }
    } catch (error) {
        console.error('Error sending stream notification:', error);
    }
}

client.login(config.get('Discord.token'));