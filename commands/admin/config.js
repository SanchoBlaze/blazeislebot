const { SlashCommandBuilder, PermissionFlagsBits } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage guild-specific settings (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a configuration value')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The setting to change')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Rules Channel', value: 'rules_channel_id' },
                            { name: 'Rules Message ID', value: 'rules_message_id' },
                            { name: 'Members Role', value: 'members_role_id' },
                            { name: 'Streams Channel', value: 'streams_channel_id' },
                            { name: 'Mod Role', value: 'mod_role_id' }
                        ))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('The new value (use the ID of the channel/role/message)')
                        .setRequired(true)))
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
                embed.addFields({ name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value: value ? `<#${value}>` : 'Not Set' });
            }
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'set') {
            const key = interaction.options.getString('key');
            const value = interaction.options.getString('value');

            try {
                const newSettings = settings.set(interaction.guild.id, key, value);
                const embed = new EmbedBuilder()
                    .setTitle('✅ Settings Updated')
                    .setDescription(`**${key}** has been updated to **${value}**.`)
                    .setColor(Colours.GREEN)
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error setting config:', error);
                await interaction.reply({ content: 'An error occurred while updating settings.', ephemeral: true });
            }
        }
    },
}; 