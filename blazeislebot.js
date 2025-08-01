'use strict';

/**
 * A bot for the Blaze Isle Discord server.
 */

const fs = require('fs');
const config = require('config');
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { Colours } = require('./modules/colours');
const Loyalty = require('./modules/loyalty');
const TwitchManager = require('./modules/twitch');
const GuildSettings = require('./modules/guildSettings');
const Economy = require('./modules/economy');
const Inventory = require('./modules/inventory');
const Farming = require('./modules/farming');


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

const twitchManager = new TwitchManager();
client.twitch = twitchManager;
client.settings = new GuildSettings(client);
client.loyalty = new Loyalty(client);
client.economy = new Economy(client);
client.inventory = new Inventory(client);
client.farming = new Farming(client);

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
    
    // Start periodic cleanup of expired effects and items
    startCleanupScheduler();
});


client.on('guildMemberAdd', (member) => {
    // Do not send welcome message here; wait until rules are accepted
    // client.loyalty.addUser will also be called after rules acceptance
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
    
    // Notify owner about configuration after a short delay
    setTimeout(async () => {
        try {
            const owner = await guild.fetchOwner();
            const embed = {
                title: '👋 Thanks for adding me to your server!',
                description: `Hi! I'm now active in **${guild.name}** and ready to help manage your community.`,
                color: 0x00FF00, // Green
                fields: [
                    {
                        name: '⚙️ Required Setup',
                        value: `To get started, please run \`/config set\` in your server and configure the following settings:`,
                        inline: false
                    },
                    {
                        name: '📋 Essential Settings',
                        value: `• **Rules Channel** - Where your server rules are posted\n• **Rules Message ID** - The message users react to for access\n• **Members Role** - Role given to users who accept rules\n• **Welcome Channel** - Where welcome messages are sent`,
                        inline: false
                    },
                    {
                        name: '🎯 Optional Features',
                        value: `• **Streams Channel** - For Twitch notifications\n• **Mod Role** - For moderation command access`,
                        inline: false
                    },
                    {
                        name: '🔧 How to Configure',
                        value: `1. Run \`/config set\` in your server\n2. Click the buttons for each setting\n3. Enter the channel/role names or IDs\n4. The bot will validate and save your settings!`,
                        inline: false
                    }
                ],
                footer: {
                    text: 'Need help? Join our support server or check the documentation!'
                },
                timestamp: new Date().toISOString()
            };

            await owner.send({ embeds: [embed] });
            console.log(`Sent welcome configuration message to ${owner.user.tag} for ${guild.name}`);
        } catch (error) {
            console.error(`Failed to send welcome message to owner of ${guild.name}:`, error.message);
        }
    }, 5000); // 5 second delay to ensure guild is fully loaded
});

client.on('interactionCreate', async interaction => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
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
        return interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
    }

    // Handle button interactions
    if (interaction.isButton()) {
        try {
            // Check if any command wants to handle this button interaction
            const configCommand = client.commands.get('config');
            if (configCommand && configCommand.handleButtonInteraction) {
                const handled = await configCommand.handleButtonInteraction(interaction);
                if (handled) return;
            }
            
            // Check for shop command button interactions
            const shopCommand = client.commands.get('shop');
            if (shopCommand && shopCommand.handleButtonInteraction) {
                const handled = await shopCommand.handleButtonInteraction(interaction);
                if (handled) return;
            }
            
            // Check for use command button interactions
            if (interaction.customId.startsWith('use_')) {
                const useCommand = client.commands.get('use');
                if (useCommand && useCommand.handleButtonInteraction) {
                    const handled = await useCommand.handleButtonInteraction(interaction);
                    if (handled) return;
                } else if (useCommand && useCommand.usePaginator) {
                    // fallback for legacy paginator
                    const userId = interaction.user.id;
                    const guildId = interaction.guild.id;
                    const inventory = client.inventory.getUserInventory(userId, guildId)
                        .filter(item => item.effect_type && item.quantity > 0);
                    const uniqueItems = {};
                    for (const item of inventory) {
                        if (!uniqueItems[item.id]) {
                            uniqueItems[item.id] = { ...item };
                        } else {
                            uniqueItems[item.id].quantity += item.quantity;
                        }
                    }
                    const allItems = Object.values(uniqueItems);
                    allItems.sort((a, b) => {
                        const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
                        const aRank = rarityOrder[a.rarity] || 99;
                        const bRank = rarityOrder[b.rarity] || 99;
                        if (aRank !== bRank) return aRank - bRank;
                        return a.name.localeCompare(b.name);
                    });
                    const pages = useCommand.createPages(allItems, client);
                    await useCommand.usePaginator(interaction, pages, allItems);
                    return;
                }
            }
            // Add farm command button interaction routing
            const farmCommand = client.commands.get('farm');
            if (farmCommand && farmCommand.handleButtonInteraction) {
                const handled = await farmCommand.handleButtonInteraction(interaction);
                if (handled) return;
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: 'There was an error processing your request!', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        try {
            // Check for shop command select menu interactions
            const shopCommand = client.commands.get('shop');
            if (shopCommand && shopCommand.handleButtonInteraction) {
                const handled = await shopCommand.handleButtonInteraction(interaction);
                if (handled) return;
            }
            // Check for use command select menu interactions
            if (interaction.customId.startsWith('use_')) {
                const useCommand = client.commands.get('use');
                if (useCommand && useCommand.handleButtonInteraction) {
                    const handled = await useCommand.handleButtonInteraction(interaction);
                    if (handled) return;
                } else if (useCommand && useCommand.usePaginator) {
                    const userId = interaction.user.id;
                    const guildId = interaction.guild.id;
                    const inventory = client.inventory.getUserInventory(userId, guildId)
                        .filter(item => item.effect_type && item.quantity > 0);
                    const uniqueItems = {};
                    for (const item of inventory) {
                        if (!uniqueItems[item.id]) {
                            uniqueItems[item.id] = { ...item };
                        } else {
                            uniqueItems[item.id].quantity += item.quantity;
                        }
                    }
                    const allItems = Object.values(uniqueItems);
                    allItems.sort((a, b) => {
                        const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
                        const aRank = rarityOrder[a.rarity] || 99;
                        const bRank = rarityOrder[b.rarity] || 99;
                        if (aRank !== bRank) return aRank - bRank;
                        return a.name.localeCompare(b.name);
                    });
                    const pages = useCommand.createPages(allItems, client);
                    await useCommand.usePaginator(interaction, pages, allItems);
                    return;
                }
            }

            // Farm select menu interactions
            if (
                interaction.customId === 'farm_plant_select' ||
                interaction.customId === 'farm_seed_select' ||
                interaction.customId === 'farm_plot_select' ||
                interaction.customId === 'farm_plant_seed' ||
                interaction.customId === 'farm_plant_plot' ||
                interaction.customId === 'farm_plant_fertiliser'
            ) {
                const farmCommand = client.commands.get('farm');
                if (farmCommand && farmCommand.handleSelect) {
                    await farmCommand.handleSelect(interaction);
                    return;
                }
            }
        } catch (error) {
            console.error('Error handling select menu interaction:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: 'There was an error processing your request!', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        try {
            // Check if any command wants to handle this modal submission
            const configCommand = client.commands.get('config');
            if (configCommand && configCommand.handleModalSubmit) {
                const handled = await configCommand.handleModalSubmit(interaction);
                if (handled) return;
            }
        } catch (error) {
            console.error('Error handling modal submission:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: 'There was an error processing your submission!', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
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

    // Check if guild is configured for rules feature
    const settings = await client.settings.safeGet(reaction.message.guild.id, 'rules');
    if (!settings) {
        return; // Guild not configured - owner has been notified
    }

    const rulesChannelId = settings.rules_channel_id;
    const rulesMessageId = settings.rules_message_id;
    const membersRoleId = settings.members_role_id;

    // Only proceed if the reaction is in the rules channel and on the rules message
    if (
        reaction.message.channel.id === rulesChannelId &&
        reaction.message.id === rulesMessageId &&
        reaction.emoji.name === '✅'
    ) {
        const guild = reaction.message.guild;
        if (!guild) return;
        const member = await guild.members.fetch(user.id);
        if (!member.roles.cache.has(membersRoleId)) {
            try {
                await member.roles.add(membersRoleId, 'Accepted rules');
            } catch (err) {
                console.error(`Failed to add Members role to ${user.tag} (${user.id}):`, err);
            }
            // Send welcome message in configured welcome channel
            const welcomeSettings = await client.settings.safeGet(guild.id, 'welcome');
            if (welcomeSettings && welcomeSettings.welcome_channel_id) {
                const welcomeChannel = guild.channels.cache.get(welcomeSettings.welcome_channel_id);
                if (welcomeChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Welcome to **${guild}**`)
                        .setDescription(`Hey ${user.toString()}, thanks for joining!`)
                        .setColor(Colours.WELCOME_GREEN)
                        .setThumbnail(user.displayAvatarURL());
                    welcomeChannel.send({ embeds: [embed] });
                } else {
                    console.log(`Welcome channel with ID ${welcomeSettings.welcome_channel_id} not found in guild ${guild.name}`);
                }
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

// Chat activity XP system
client.on('messageCreate', async message => {
    // Don't give XP to bots
    if (message.author.bot) return;
    
    // Only in guilds
    if (!message.guild) return;
    
    // Don't give XP for commands (they have their own XP rewards)
    if (message.content.startsWith('/')) return;
    
    // Add XP for chat activity (small amount to encourage conversation)
    try {
        await client.loyalty.addXp(1, message.author, message.guild);
    } catch (error) {
        console.error('Error adding XP for chat activity:', error);
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
                const updateResult = await twitchManager.updateStreamStatus(username);
                
                // Handle stream going live
                if (updateResult.isLive && (!currentStatus || !currentStatus.is_live)) {
                    await sendStreamNotification(username, updateResult.streamData);
                    await twitchManager.markNotificationSent(username);
                }
                // Handle stream going live with different stream ID (new session)
                else if (updateResult.isLive && currentStatus && currentStatus.is_live && 
                         currentStatus.stream_id !== updateResult.streamData.id) {
                    // Stream is live but with a different stream ID (new session)
                    // First mark the old stream as ended
                    await sendStreamEndNotification(username);
                    // Then send notification for new stream
                    await sendStreamNotification(username, updateResult.streamData);
                    await twitchManager.markNotificationSent(username);
                }
                // Handle stream ending
                else if (!updateResult.isLive && currentStatus && currentStatus.is_live) {
                    // Stream just ended - send end notification
                    await sendStreamEndNotification(username);
                    await twitchManager.resetNotificationSent(username);
                }
                // Handle viewer count updates for live streams
                else if (updateResult.isLive && currentStatus && currentStatus.is_live && 
                         updateResult.streamData.viewer_count !== currentStatus.viewer_count) {
                    
                    // Check if there are existing notification messages for this stream
                    const existingMessages = await twitchManager.getNotificationMessages(username, updateResult.streamData.id);
                    
                    if (currentStatus.notification_sent || existingMessages.length > 0) {
                        // Stream is live and viewer count changed - update existing notification
                        await updateStreamNotification(username, updateResult.streamData);
                    } else {
                        // Stream is live but notification hasn't been sent yet - send initial notification
                        await sendStreamNotification(username, updateResult.streamData);
                        await twitchManager.markNotificationSent(username);
                    }
                }
            }
        } catch (error) {
            console.error('Error in Twitch checker:', error);
        }
    }, 1 * 60 * 1000); // Check every 1 minute
}

async function sendStreamNotification(twitchUsername, streamData) {
    try {
        const subscriptions = await twitchManager.getSubscriptionsForUser(twitchUsername);
        
        for (const subscription of subscriptions) {
            const guild = client.guilds.cache.get(subscription.guild_id);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(subscription.channel_id);
            if (!channel) {
                console.error(`Streams channel with ID ${subscription.channel_id} not found in guild ${guild.name}`);
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
            
            const message = await channel.send({ 
                content: `🎉 **${twitchUsername}** is now live! <https://twitch.tv/${twitchUsername}>`,
                embeds: [embed] 
            });
            
            // Save the message ID for future updates
            if (streamData.id) {
                await twitchManager.saveNotificationMessage(twitchUsername, guild.id, channel.id, message.id, streamData.id);
            }
        }
    } catch (error) {
        console.error('Error sending stream notification:', error);
    }
}

async function sendStreamEndNotification(twitchUsername) {
    try {
        const currentStatus = await twitchManager.getStreamStatus(twitchUsername);
        if (!currentStatus || !currentStatus.stream_id) {
            return; // No stream ID to work with
        }

        const notificationMessages = await twitchManager.getNotificationMessages(twitchUsername, currentStatus.stream_id);
        
        for (const notificationMsg of notificationMessages) {
            const guild = client.guilds.cache.get(notificationMsg.guild_id);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(notificationMsg.channel_id);
            if (!channel) {
                console.error(`Streams channel with ID ${notificationMsg.channel_id} not found in guild ${guild.name}`);
                continue;
            }
            
            try {
                const message = await channel.messages.fetch(notificationMsg.message_id);
                
                const embed = new EmbedBuilder()
                    .setTitle('⚫ Stream Ended')
                    .setDescription(`**${twitchUsername}** has ended their stream.`)
                    .setColor(Colours.GREY)
                    .setTimestamp()
                    .setURL(`https://twitch.tv/${twitchUsername}`);
                
                await message.edit({ 
                    content: `📺 **${twitchUsername}** has ended their stream. <https://twitch.tv/${twitchUsername}>`,
                    embeds: [embed] 
                });
            } catch (error) {
                console.error(`Error editing stream end notification for ${twitchUsername}:`, error);
                // If message not found, send a new one
                const embed = new EmbedBuilder()
                    .setTitle('⚫ Stream Ended')
                    .setDescription(`**${twitchUsername}** has ended their stream.`)
                    .setColor(Colours.GREY)
                    .setTimestamp()
                    .setURL(`https://twitch.tv/${twitchUsername}`);
                
                await channel.send({ 
                    content: `📺 **${twitchUsername}** has ended their stream.`,
                    embeds: [embed] 
                });
            }
        }
        
        // Clean up notification messages
        await twitchManager.deleteNotificationMessages(twitchUsername, currentStatus.stream_id);
    } catch (error) {
        console.error('Error sending stream end notification:', error);
    }
}

async function updateStreamNotification(twitchUsername, streamData) {
    try {
        if (!streamData.id) {
            return; // No stream ID to work with
        }

        const notificationMessages = await twitchManager.getNotificationMessages(twitchUsername, streamData.id);
        
        for (const notificationMsg of notificationMessages) {
            const guild = client.guilds.cache.get(notificationMsg.guild_id);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(notificationMsg.channel_id);
            if (!channel) {
                console.error(`Streams channel with ID ${notificationMsg.channel_id} not found in guild ${guild.name}`);
                continue;
            }
            
            try {
                const message = await channel.messages.fetch(notificationMsg.message_id);
                
                const embed = new EmbedBuilder()
                    .setTitle('🔴 LIVE NOW!')
                    .setDescription(`**${twitchUsername}** is live on Twitch!`)
                    .addFields(
                        { name: 'Title', value: streamData.title || 'No title', inline: true },
                        { name: 'Game', value: streamData.game_name || 'No game', inline: true },
                        { name: 'Viewers', value: streamData.viewer_count?.toString() || 'Unknown', inline: true }
                    )
                    .setColor(Colours.RED)
                    .setTimestamp()
                    .setURL(`https://twitch.tv/${twitchUsername}`)
                    .setThumbnail(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${twitchUsername}-320x180.jpg`);
                
                await message.edit({ 
                    content: `🎉 **${twitchUsername}** is now live! <https://twitch.tv/${twitchUsername}>`,
                    embeds: [embed] 
                });
            } catch (error) {
                console.error(`Error editing stream notification for ${twitchUsername}:`, error);
                // If message not found, the notification will be recreated on next live check
            }
        }
    } catch (error) {
        console.error('Error updating stream notification:', error);
    }
}

// Periodic cleanup function
function startCleanupScheduler() {
    // Run cleanup every 30 minutes
    setInterval(() => {
        try {
            // Clean up expired effects
            const expiredEffects = client.inventory.cleanupExpiredEffects();
            if (expiredEffects > 0) {
                console.log(`[cleanup] Removed ${expiredEffects} expired effects`);
            }
            
            // Clean up expired inventory items
            const expiredItems = client.inventory.cleanupExpiredEffects();
            if (expiredItems > 0) {
                console.log(`[cleanup] Removed ${expiredItems} expired inventory items`);
            }
        } catch (error) {
            console.error('[cleanup] Error during cleanup:', error);
        }
    }, 30 * 60 * 1000); // 30 minutes
    
    // Also run cleanup immediately on startup
    setTimeout(() => {
        try {
            const expiredEffects = client.inventory.cleanupExpiredEffects();
            const expiredItems = client.inventory.cleanupExpiredEffects();
            if (expiredEffects > 0 || expiredItems > 0) {
                console.log(`[startup cleanup] Removed ${expiredEffects} expired effects and ${expiredItems} expired items`);
            }
        } catch (error) {
            console.error('[startup cleanup] Error during cleanup:', error);
        }
    }, 5000); // 5 seconds after startup
}

client.login(config.get('Discord.token'));