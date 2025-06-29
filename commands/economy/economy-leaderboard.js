const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy-leaderboard')
        .setDescription('Show the richest users in the server')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show (1-25)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const limit = interaction.options.getInteger('limit') || 10;

        try {
            const leaderboard = interaction.client.economy.getLeaderboard(guildId, limit);
            
            if (leaderboard.length === 0) {
                return interaction.reply({ 
                    content: 'No economy data found for this server!', 
                    ephemeral: true 
                });
            }

            let description = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                const user = await interaction.client.users.fetch(entry.user).catch(() => null);
                const username = user ? user.username : 'Unknown User';
                
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                description += `${medal} **${username}** - ${interaction.client.economy.formatCurrency(entry.total)}\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏆 Economy Leaderboard')
                .setDescription(description)
                .setFooter({ text: `Showing top ${leaderboard.length} users by net worth` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in economy leaderboard command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching the leaderboard!', 
                ephemeral: true 
            });
        }
    },
}; 