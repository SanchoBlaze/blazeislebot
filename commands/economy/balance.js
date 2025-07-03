const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check balance for (optional)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        try {
            const user = interaction.client.economy.getUser(targetUser.id, guildId);
            const netWorth = interaction.client.economy.getNetWorth(targetUser.id, guildId);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`💰 ${targetUser.username}'s Balance`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '💵 Wallet', value: interaction.client.economy.formatCurrency(user.balance), inline: true },
                    { name: '🏦 Bank', value: interaction.client.economy.formatCurrency(user.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(netWorth), inline: true },
                    { name: '📈 Total Earned', value: interaction.client.economy.formatCurrency(user.total_earned), inline: true },
                    { name: '📉 Total Spent', value: interaction.client.economy.formatCurrency(user.total_spent), inline: true },
                    { name: '📅 Member Since', value: new Date(user.created_at).toLocaleDateString(), inline: true }
                )
                .setFooter({ text: 'Use /daily and /work to earn more coins!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Error checking balance:', error);
            await interaction.reply({ content: 'There was an error checking the balance!', flags: MessageFlags.Ephemeral });
        }
    },
}; 