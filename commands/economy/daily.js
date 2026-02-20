const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward (100 coins)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Get user's balance before daily reward
            const userBefore = interaction.client.economy.getUser(userId, guildId);
            const balanceBefore = userBefore.balance;
            
            const result = await interaction.client.economy.daily(userId, guildId);
            
            // Calculate the actual amount received
            const actualAmount = result.balance - balanceBefore;
            const baseAmount = 100;
            const hadMultiplier = actualAmount > baseAmount;
            
            const embed = new EmbedBuilder()
                .setColor(hadMultiplier ? 0xFFD700 : 0x00FF00) // Gold if had multiplier, green if not
                .setTitle('🎉 Daily Reward Claimed!')
                .setDescription(`You received **${interaction.client.economy.formatCurrency(actualAmount)}** as your daily reward!`)
                .addFields(
                    { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(result.balance), inline: true },
                    { name: '🏦 Bank', value: interaction.client.economy.formatCurrency(result.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(result.balance + result.bank), inline: true }
                )
                .setFooter({ text: 'Come back tomorrow for another reward!' })
                .setTimestamp();

            // Add multiplier info if user had daily doubler
            if (hadMultiplier) {
                const dailyMultiplier = interaction.client.inventory.getDailyMultiplier(userId, guildId);
                embed.addFields({
                    name: '🚀 Daily Multiplier Active!',
                    value: `Your daily reward was multiplied by ${dailyMultiplier}x from ${interaction.client.economy.formatCurrency(baseAmount)} to ${interaction.client.economy.formatCurrency(actualAmount)}!`,
                    inline: false
                });
            }
            
            // Add luck boost info if user had luck boost
            const luckBoost = interaction.client.inventory.getLuckBoost(userId, guildId);
            if (luckBoost > 1) {
                embed.addFields({
                    name: '🍀 Luck Boost Active!',
                    value: `You received a luck bonus on your daily reward!`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                console.error('Error in daily command:', error);
                await interaction.reply({ content: 'There was an error processing your daily reward!', flags: MessageFlags.Ephemeral });
            }
        }
    },
}; 