const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage guild-specific settings (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set configuration values using an interactive interface'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View the current guild settings')),
    guildOnly: true,
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const settings = interaction.client.settings;

        if (subcommand === 'view') {
            const guildSettings = settings.get(interaction.guild.id);
            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Settings for ${interaction.guild.name}`)
                .setColor(Colours.BLUE)
                .setTimestamp();

            for (const [key, value] of Object.entries(guildSettings)) {
                if (key === 'guild_id') continue;
                
                let displayValue = 'Not Set';
                if (value) {
                    if (key.includes('channel')) {
                        displayValue = `<#${value}>`;
                    } else if (key.includes('role')) {
                        displayValue = `<@&${value}>`;
                    } else {
                        displayValue = value;
                    }
                }
                
                embed.addFields({ 
                    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
                    value: displayValue,
                    inline: true
                });
            }
            
            return interaction.reply({ embeds: [embed], flags: 64 }); // MessageFlags.Ephemeral
        }

        if (subcommand === 'set') {
            // Create an embed with configuration options
            const configEmbed = new EmbedBuilder()
                .setTitle('⚙️ Configuration Settings')
                .setDescription('Choose which setting you\'d like to configure:')
                .setColor(Colours.BLUE)
                .addFields(
                    { name: '📋 Rules Channel', value: 'Channel where rules are posted', inline: true },
                    { name: '📝 Rules Message ID', value: 'ID of the rules message to react to', inline: true },
                    { name: '👥 Members Role', value: 'Role given when users accept rules', inline: true },
                    { name: '📺 Streams Channel', value: 'Channel for Twitch stream notifications', inline: true },
                    { name: '🛡️ Mod Role', value: 'Role for moderators', inline: true },
                    { name: '👋 Welcome Channel', value: 'Channel for welcome messages', inline: true },
                    { name: '🎉 Loyalty Channel', value: 'Channel for level-up notifications', inline: true },
                    { name: '💸 Economy Channel', value: 'Channel for economy notifications', inline: true },
                    { name: '📢 Announcement Channel', value: 'Channel for bot announcements', inline: true }
                )
                .setFooter({ text: 'Click a button below to set the corresponding value' });

            // Create buttons for each configuration option
            const configButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('config_set_rules_channel_id')
                        .setLabel('Rules Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📋'),
                    new ButtonBuilder()
                        .setCustomId('config_set_rules_message_id')
                        .setLabel('Rules Message ID')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('config_set_members_role_id')
                        .setLabel('Members Role')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👥')
                );

            const configButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('config_set_streams_channel_id')
                        .setLabel('Streams Channel')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📺'),
                    new ButtonBuilder()
                        .setCustomId('config_set_mod_role_id')
                        .setLabel('Mod Role')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛡️'),
                    new ButtonBuilder()
                        .setCustomId('config_set_welcome_channel_id')
                        .setLabel('Welcome Channel')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('👋')
                );

            const configButtons3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('config_set_loyalty_channel_id')
                        .setLabel('Loyalty Channel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎉'),
                    new ButtonBuilder()
                        .setCustomId('config_set_economy_channel_id')
                        .setLabel('Economy Channel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💸'),
                    new ButtonBuilder()
                        .setCustomId('config_set_announcement_channel_id')
                        .setLabel('Announcement Channel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📢')
                );

            await interaction.reply({ 
                embeds: [configEmbed], 
                components: [configButtons1, configButtons2, configButtons3],
                flags: 64 // MessageFlags.Ephemeral
            });
        }
    },

    // Handle button interactions for this command
    async handleButtonInteraction(interaction) {
        if (!interaction.customId.startsWith('config_set_')) return false;

        const setting = interaction.customId.replace('config_set_', '');
        const settingName = setting.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Create modal based on the setting type
        const modal = new ModalBuilder()
            .setCustomId(`config_modal_${setting}`)
            .setTitle(`Set ${settingName}`);

        let textInput;
        if (setting.includes('channel')) {
            textInput = new TextInputBuilder()
                .setCustomId('config_value')
                .setLabel('Channel ID (Right-click channel → Copy ID)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678')
                .setRequired(true);
        } else if (setting.includes('role')) {
            textInput = new TextInputBuilder()
                .setCustomId('config_value')
                .setLabel('Role ID (Right-click role → Copy ID)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678')
                .setRequired(true);
        } else if (setting === 'rules_message_id') {
            textInput = new TextInputBuilder()
                .setCustomId('config_value')
                .setLabel('Message ID (Right-click message → Copy ID)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678')
                .setRequired(true);
        }

        const actionRow = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
        return true;
    },

    // Handle modal submissions for this command
    async handleModalSubmit(interaction) {
        if (!interaction.customId.startsWith('config_modal_')) return false;

        const setting = interaction.customId.replace('config_modal_', '');
        const value = interaction.fields.getTextInputValue('config_value');
        const settings = interaction.client.settings;
        
        let processedValue = value;
        let displayValue = value;

        try {
            // Process the input based on setting type
            if (setting.includes('channel')) {
                let channel = null;
                
                // Try to extract channel ID from mention first
                const channelMention = value.match(/<#(\d+)>/);
                if (channelMention) {
                    channel = interaction.guild.channels.cache.get(channelMention[1]);
                }
                
                // Try to use as direct ID
                if (!channel && /^\d{17,20}$/.test(value.trim())) {
                    channel = interaction.guild.channels.cache.get(value.trim());
                }
                
                // Try to find by name (with or without #)
                if (!channel) {
                    const channelName = value.replace(/^#/, '').toLowerCase().trim();
                    channel = interaction.guild.channels.cache.find(ch => 
                        ch.name.toLowerCase() === channelName && ch.isTextBased()
                    );
                }
                
                if (channel) {
                    processedValue = channel.id;
                    displayValue = `<#${channel.id}>`;
                } else {
                    throw new Error('Channel not found. Please check the channel name or copy the channel ID.');
                }
            } else if (setting.includes('role')) {
                let role = null;
                
                // Try to extract role ID from mention first
                const roleMention = value.match(/<@&(\d+)>/);
                if (roleMention) {
                    role = interaction.guild.roles.cache.get(roleMention[1]);
                }
                
                // Try to use as direct ID
                if (!role && /^\d{17,20}$/.test(value.trim())) {
                    role = interaction.guild.roles.cache.get(value.trim());
                }
                
                // Try to find by name (with or without @)
                if (!role) {
                    const roleName = value.replace(/^@/, '').toLowerCase().trim();
                    role = interaction.guild.roles.cache.find(r => 
                        r.name.toLowerCase() === roleName
                    );
                }
                
                if (role) {
                    processedValue = role.id;
                    displayValue = `<@&${role.id}>`;
                } else {
                    throw new Error('Role not found. Please check the role name or copy the role ID.');
                }
            } else if (setting === 'rules_message_id') {
                // Validate message ID format
                if (!/^\d+$/.test(value)) {
                    throw new Error('Invalid message ID format');
                }
            }

            // Update the setting in the database
            settings.set(interaction.guild.id, setting, processedValue);

            const settingName = setting.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Configuration Updated')
                .setDescription(`Successfully set **${settingName}** to ${displayValue}`)
                .setColor(Colours.GREEN)
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed], flags: 64 }); // MessageFlags.Ephemeral
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Configuration Error')
                .setDescription(`Failed to set configuration: ${error.message}`)
                .setColor(Colours.RED)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], flags: 64 }); // MessageFlags.Ephemeral
        }

        return true;
    }
}; 