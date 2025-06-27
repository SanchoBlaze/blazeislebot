const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Colours } = require('../../modules/colours');
const config = require('config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch stream notifications (Mod/Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a Twitch channel to stream notifications')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to subscribe to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a Twitch channel from stream notifications')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to unsubscribe from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all subscribed Twitch channels'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check the status of a Twitch channel')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to check')
                        .setRequired(true))),
    guildOnly: true,
    async execute(interaction) {
        // Check if guild is configured for Twitch features
        const settings = await interaction.client.settings.safeGet(interaction.guild.id, 'twitch');
        if (!settings) {
            return interaction.reply({
                content: '⚙️ This server is not configured for Twitch notifications. The server owner has been notified to set up the bot configuration.',
                ephemeral: true
            });
        }

        const modRoleId = settings.mod_role_id;
        const isAdministrator = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModRole = modRoleId ? interaction.member.roles.cache.has(modRoleId) : false;

        if (!isAdministrator && !hasModRole) {
            return interaction.reply({
                content: 'You need to be a server Administrator or have the configured Mod role to use this command.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const twitchManager = interaction.client.twitch;

        if (!twitchManager) {
            return interaction.reply({ 
                content: 'Twitch integration is not available.', 
                ephemeral: true 
            });
        }

        try {
            switch (subcommand) {
                case 'add': {
                    const username = interaction.options.getString('username');
                    const streamsChannelId = settings.streams_channel_id;
                    const success = await twitchManager.addSubscription(
                        interaction.guild.id,
                        streamsChannelId,
                        username,
                        interaction.user.id
                    );

                    if (success) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Twitch Subscription Added')
                            .setDescription(`Successfully subscribed to **${username}** for stream notifications in the streams channel.`)
                            .setColor(Colours.GREEN)
                            .setTimestamp();
                        await interaction.reply({ embeds: [embed] });
                    } else {
                        await interaction.reply({ 
                            content: 'Failed to add subscription. Please try again.', 
                            ephemeral: true 
                        });
                    }
                    break;
                }

                case 'remove': {
                    const username = interaction.options.getString('username');
                    const success = await twitchManager.removeSubscription(
                        interaction.guild.id,
                        username
                    );

                    if (success) {
                        const embed = new EmbedBuilder()
                            .setTitle('❌ Twitch Subscription Removed')
                            .setDescription(`Successfully unsubscribed from **${username}**.`)
                            .setColor(Colours.RED)
                            .setTimestamp();
                        await interaction.reply({ embeds: [embed] });
                    } else {
                        await interaction.reply({ 
                            content: 'Subscription not found or failed to remove.', 
                            ephemeral: true 
                        });
                    }
                    break;
                }

                case 'list': {
                    const subscriptions = await twitchManager.getSubscriptions(interaction.guild.id);
                    
                    if (subscriptions.length === 0) {
                        const embed = new EmbedBuilder()
                            .setTitle('📺 Twitch Subscriptions')
                            .setDescription('No Twitch channels are currently subscribed for notifications.')
                            .setColor(Colours.GREY)
                            .setTimestamp();
                        await interaction.reply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setTitle('📺 Twitch Subscriptions')
                            .setDescription(`**${subscriptions.length}** channel(s) subscribed:`)
                            .setColor(Colours.BLUE)
                            .setTimestamp();

                        const subscriptionList = subscriptions.map(sub => 
                            `• **${sub.twitch_username}** (added by <@${sub.added_by}>)`
                        ).join('\n');

                        embed.addFields({ 
                            name: 'Subscribed Channels', 
                            value: subscriptionList 
                        });

                        await interaction.reply({ embeds: [embed] });
                    }
                    break;
                }

                case 'status': {
                    const username = interaction.options.getString('username');
                    const status = await twitchManager.getStreamStatus(username);
                    
                    if (!status) {
                        const embed = new EmbedBuilder()
                            .setTitle(`📺 ${username} - Stream Status`)
                            .setDescription('No status information available for this channel.')
                            .setColor(Colours.GREY)
                            .setTimestamp();
                        await interaction.reply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setTitle(`📺 ${username} - Stream Status`)
                            .setColor(status.is_live ? Colours.RED : Colours.GREY)
                            .setTimestamp();

                        if (status.is_live) {
                            embed.addFields(
                                { name: 'Status', value: '🔴 **LIVE**', inline: true },
                                { name: 'Title', value: status.stream_title || 'No title', inline: true },
                                { name: 'Game', value: status.game_name || 'No game', inline: true },
                                { name: 'Viewers', value: status.viewer_count?.toString() || 'Unknown', inline: true },
                                { name: 'Started', value: new Date(status.started_at).toLocaleString(), inline: true },
                                { name: 'Last Checked', value: new Date(status.last_checked).toLocaleString(), inline: true }
                            );
                        } else {
                            embed.addFields(
                                { name: 'Status', value: '⚫ **OFFLINE**', inline: true },
                                { name: 'Last Checked', value: new Date(status.last_checked).toLocaleString(), inline: true }
                            );
                        }

                        await interaction.reply({ embeds: [embed] });
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error in twitch command:', error);
            await interaction.reply({ 
                content: 'An error occurred while processing your request.', 
                ephemeral: true 
            });
        }
    },
}; 