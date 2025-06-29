const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward (100 coins)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const result = await interaction.client.economy.daily(userId, guildId);
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎉 Daily Reward Claimed!')
                .setDescription(`You received **100 coins** as your daily reward!`)
                .addFields(
                    { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(result.balance), inline: true },
                    { name: '🏦 Bank', value: interaction.client.economy.formatCurrency(result.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(result.balance + result.bank), inline: true }
                )
                .setFooter({ text: 'Come back tomorrow for another reward!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            if (error.message.includes('Daily reward available in')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Daily Reward Not Ready')
                    .setDescription(`You've already claimed your daily reward today!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Daily reward available in ', ''), inline: true }
                    )
                    .setFooter({ text: 'Daily rewards reset every 24 hours' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                console.error('Error in daily command:', error);
                await interaction.reply({ 
                    content: 'There was an error claiming your daily reward!', 
                    ephemeral: true 
                });
            }
        }
    },
}; 