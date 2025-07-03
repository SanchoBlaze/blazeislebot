const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn coins (10-50 coins, 1 hour cooldown)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const result = await interaction.client.economy.work(userId, guildId);
            
            const workMessages = [
                "You worked as a programmer and fixed some bugs!",
                "You delivered food and got a nice tip!",
                "You helped someone with their homework!",
                "You cleaned the office and found some loose change!",
                "You worked overtime and earned extra pay!",
                "You freelanced as a graphic designer!",
                "You tutored a student in math!",
                "You worked as a waiter and got good tips!",
                "You helped move furniture for a neighbor!",
                "You worked on a weekend project!"
            ];
            
            const randomMessage = workMessages[Math.floor(Math.random() * workMessages.length)];

            // Check if user has work multiplier
            const workMultiplier = interaction.client.inventory.getWorkMultiplier(userId, guildId);
            const hasMultiplier = workMultiplier > 1;

            const embed = new EmbedBuilder()
                .setColor(hasMultiplier ? 0xFFD700 : 0x00FF00) // Gold if has multiplier, green if not
                .setTitle('💼 Work Complete!')
                .setDescription(`${randomMessage}`)
                .addFields(
                    { name: '💰 Earned', value: interaction.client.economy.formatCurrency(result.amount), inline: true },
                    { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(result.user.balance), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(result.user.balance + result.user.bank), inline: true }
                )
                .setFooter({ text: 'You can work again in 1 hour!' })
                .setTimestamp();

            // Add multiplier info if user has active work boost
            if (hasMultiplier) {
                embed.addFields({
                    name: '🚀 Work Boost Active!',
                    value: `You're getting ${workMultiplier}x coins from work!`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            if (error.message.includes('Work available in')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Work Not Ready')
                    .setDescription(`You need to rest before working again!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Work available in ', ''), inline: true }
                    )
                    .setFooter({ text: 'Work has a 1-hour cooldown' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                console.error('Error in work command:', error);
                await interaction.reply({ content: 'There was an error processing your work!', flags: MessageFlags.Ephemeral });
            }
        }
    },
}; 