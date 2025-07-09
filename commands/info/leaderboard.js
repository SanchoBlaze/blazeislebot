const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View various leaderboards')
        .addSubcommand(sub =>
            sub.setName('farm')
                .setDescription('Top users by crops harvested')
        )
        .addSubcommand(sub =>
            sub.setName('economy')
                .setDescription('Top users by net worth')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of users to show (1-25)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25))
        )
        .addSubcommand(sub =>
            sub.setName('loyalty')
                .setDescription('Top users by XP/level')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'farm') {
            // Farm leaderboard: top users by crops harvested
            const guildId = interaction.guild.id;
            // Ensure farm_stats table exists and is updated on harvests
            if (!interaction.client.farming.getFarmLeaderboard) {
                return interaction.reply({ content: 'Farm leaderboard is not available.', ephemeral: true });
            }
            const top10 = interaction.client.farming.getFarmLeaderboard(guildId, 10);
            if (!top10 || top10.length === 0) {
                return interaction.reply({ content: 'No farm data found for this server!', ephemeral: true });
            }
            let description = '';
            for (let i = 0; i < top10.length; i++) {
                const entry = top10[i];
                const user = await interaction.client.users.fetch(entry.user).catch(() => null);
                const username = user ? user.username : 'Unknown User';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                description += `${medal} **${username}** - **${entry.crops_harvested}** crops harvested\n`;
            }
            const embed = new EmbedBuilder()
                .setColor(0x32CD32)
                .setTitle('🌾 Farm Leaderboard')
                .setDescription(description)
                .setFooter({ text: `Showing top ${top10.length} users by crops harvested` })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'economy') {
            // Economy leaderboard: top users by net worth
            const guildId = interaction.guild.id;
            const limit = interaction.options.getInteger('limit') || 10;
            const leaderboard = interaction.client.economy.getLeaderboard(guildId, limit);
            if (!leaderboard || leaderboard.length === 0) {
                return interaction.reply({ content: 'No economy data found for this server!', ephemeral: true });
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
        } else if (sub === 'loyalty') {
            // Loyalty leaderboard: top users by XP/level
            const top10 = interaction.client.loyalty.getLeaders(interaction.guild);
            if (!top10 || top10.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('📊 XP Leaderboard')
                        .setDescription('No XP data found yet. Start chatting to earn XP!')
                        .setColor(Colours.BLUE)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
            const members = await interaction.guild.members.fetch();
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${interaction.guild.name} XP Leaderboard`)
                .setDescription('🏆 **Top 10 XP Leaders** 🏆')
                .setColor(Colours.GOLD)
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            let leaderboardText = '';
            for (let i = 0; i < top10.length; i++) {
                const data = top10[i];
                const member = members.find(member => member.id === data.user);
                const username = member ? member.user.username : `Unknown User`;
                const actualLevel = interaction.client.loyalty.getLevelFromXp(data.xp);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardText += `${medal} **${username}**\n   Level **${actualLevel}** • **${data.xp.toLocaleString()}** XP\n\n`;
            }
            embed.setDescription(leaderboardText);
            await interaction.reply({ embeds: [embed] });
        }
    },
}; 