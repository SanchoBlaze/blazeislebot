const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');
const { EmbedBuilder } = require('discord.js');
const { MessageFlags } = require('discord.js');

function getLevelBadge(level) {
    if (level >= 50) return '💎';
    if (level >= 30) return '🏆';
    if (level >= 15) return '🥈';
    if (level >= 5) return '🥉';
    return '🌱';
}

function getRankEmoji(position) {
    switch(position) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return `${position}.`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard_old')
        .setDescription('View the top XP leaders in the server'),
    async execute(interaction) {
        const top10 = interaction.client.loyalty.getLeaders(interaction.guild);

        if (top10.length === 0) {
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

        // Create enhanced leaderboard embed
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
            const levelBadge = getLevelBadge(data.level);
            const rankEmoji = getRankEmoji(i + 1);
            
            // Calculate actual level from XP to ensure consistency
            const actualLevel = interaction.client.loyalty.getLevelFromXp(data.xp);
            
            leaderboardText += `${rankEmoji} ${levelBadge} **${username}**\n`;
            leaderboardText += `   Level **${actualLevel}** • **${data.xp.toLocaleString()}** XP\n\n`;
        }

        embed.setDescription(leaderboardText);

        // Add footer with user's rank if they're not in top 10
        const userLoyalty = interaction.client.loyalty.getLoyalty(interaction.user.id, interaction.guild.id);
        if (userLoyalty) {
            const allUsers = interaction.client.loyalty.getLeaders(interaction.guild); // This gets all users, not just top 10
            // For now, we'll just show if they're in top 10 or not
            const userInTop10 = top10.find(user => user.user === interaction.user.id);
            if (!userInTop10) {
                embed.setFooter({ 
                    text: `Your rank: Not in top 10 • Level ${userLoyalty.level} • ${userLoyalty.xp.toLocaleString()} XP`,
                    iconURL: interaction.user.displayAvatarURL()
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    },
};