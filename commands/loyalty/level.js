const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Get detailed level information for a user')
        .addUserOption(option => option.setName('target').setDescription('The user to show level information for')),
    async execute(interaction) {
        let user = interaction.options.getUser('target') || interaction.user;
        const isOwnLevel = user.id === interaction.user.id;

        const userXp = interaction.client.loyalty.getXp(user, interaction.guild);
        const userLevel = interaction.client.loyalty.getLevel(user, interaction.guild);
        
        // Calculate level milestones
        const currentLevelXp = interaction.client.loyalty.getXpForLevel(userLevel);
        const nextLevelXp = interaction.client.loyalty.getXpForLevel(userLevel + 1);
        
        // Calculate XP needed for each individual level
        const currentLevelRequirement = userLevel === 0 ? 0 : interaction.client.loyalty.getXpForLevel(userLevel);
        const nextLevelRequirement = interaction.client.loyalty.getXpForLevel(userLevel + 1);
        const progress = interaction.client.loyalty.getXpProgress(userXp, userLevel);
        
        // Create level badges based on level ranges
        let levelBadge = '🥚'; // Starting
        if (userLevel >= 50) levelBadge = '💎'; // Diamond
        else if (userLevel >= 30) levelBadge = '🏆'; // Gold
        else if (userLevel >= 15) levelBadge = '🥈'; // Silver
        else if (userLevel >= 5) levelBadge = '🥉'; // Bronze
        else if (userLevel >= 1) levelBadge = '🌱'; // Newcomer

        // Create progress bar
        const progressBarLength = 15;
        const filledBars = Math.floor((progress.percentage / 100) * progressBarLength);
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(emptyBars);

        const embed = new EmbedBuilder()
            .setTitle(`${levelBadge} ${isOwnLevel ? 'Your Level' : `${user.username}'s Level`}`)
            .setColor(Colours.GOLD)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '📊 Current Level', value: `**${userLevel}**`, inline: true },
                { name: '⭐ Total XP', value: `**${userXp.toLocaleString()}**`, inline: true },
                { name: '🎯 Next Level', value: `**${userLevel + 1}**`, inline: true },
                { 
                    name: '📈 Progress to Next Level', 
                    value: `${progressBar} **${progress.percentage}%**\n**${progress.current.toLocaleString()}** / **${progress.total.toLocaleString()}** XP`,
                    inline: false 
                },
                {
                    name: '🏅 Level Milestones',
                    value: `**Level ${userLevel}:** ${currentLevelRequirement.toLocaleString()} XP needed\n**Level ${userLevel + 1}:** ${nextLevelRequirement.toLocaleString()} XP needed`,
                    inline: true
                },
                {
                    name: '📊 Level Range',
                    value: getLevelRange(userLevel),
                    inline: true
                }
            )
            .setFooter({ text: `${(nextLevelXp - userXp).toLocaleString()} XP needed for level ${userLevel + 1}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};

function getLevelRange(level) {
    if (level >= 50) return '💎 Diamond (50+)';
    if (level >= 30) return '🏆 Gold (30-49)';
    if (level >= 15) return '🥈 Silver (15-29)';
    if (level >= 5) return '🥉 Bronze (5-14)';
    if (level >= 1) return '🌱 Newcomer (1-4)';
    return '🥚 Starting (0)';
}