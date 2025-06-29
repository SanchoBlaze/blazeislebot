const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw coins from your bank to your wallet')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to withdraw')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const amount = interaction.options.getInteger('amount');

        try {
            const result = interaction.client.economy.withdraw(userId, guildId, amount);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏦 Withdrawal Successful!')
                .setDescription(`You withdrew **${interaction.client.economy.formatCurrency(amount)}** from your bank`)
                .addFields(
                    { name: '💵 New Wallet Balance', value: interaction.client.economy.formatCurrency(result.balance), inline: true },
                    { name: '🏦 New Bank Balance', value: interaction.client.economy.formatCurrency(result.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(result.balance + result.bank), inline: true }
                )
                .setFooter({ text: 'Your coins are now in your wallet!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            if (error.message === 'Insufficient bank balance') {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Insufficient Funds')
                    .setDescription(`You don't have enough coins in your bank to withdraw ${interaction.client.economy.formatCurrency(amount)}!`)
                    .addFields(
                        { name: '🏦 Your Bank Balance', value: interaction.client.economy.formatCurrency(user.bank), inline: true },
                        { name: '💰 Withdrawal Amount', value: interaction.client.economy.formatCurrency(amount), inline: true }
                    )
                    .setFooter({ text: 'Make sure you have enough coins in your bank!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                console.error('Error in withdraw command:', error);
                await interaction.reply({ content: 'There was an error processing your withdrawal!', flags: MessageFlags.Ephemeral });
            }
        }
    },
}; 