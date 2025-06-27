const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Get the XP and level information of a user')
        .addUserOption(option => option.setName('target').setDescription('The user to show XP for')),
    async execute(interaction) {
        let user = interaction.options.getUser('target') || interaction.user;
        const isOwnXp = user.id === interaction.user.id;

        const userXp = interaction.client.loyalty.getXp(user, interaction.guild);
        const userLevel = interaction.client.loyalty.getLevel(user, interaction.guild);
        
        // Get progress information
        const progress = interaction.client.loyalty.getXpProgress(userXp, userLevel);
        const xpForNextLevel = interaction.client.loyalty.getXpForNextLevel(userXp, userLevel);
        
        // Create progress bar
        const progressBarLength = 20;
        const filledBars = Math.floor((progress.percentage / 100) * progressBarLength);
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        const embed = new EmbedBuilder()
            .setTitle(`${isOwnXp ? 'Your' : `${user.username}'s`} XP & Level`)
            .setColor(Colours.BLUE)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '📊 Current Level', value: `**${userLevel}**`, inline: true },
                { name: '⭐ Total XP', value: `**${userXp.toLocaleString()}**`, inline: true },
                { name: '🎯 XP to Next Level', value: `**${xpForNextLevel.toLocaleString()}**`, inline: true },
                { 
                    name: '📈 Level Progress', 
                    value: `\`${progressBar}\` ${progress.percentage}%\n**${progress.current.toLocaleString()}** / **${progress.total.toLocaleString()}** XP`,
                    inline: false 
                }
            )
            .setFooter({ text: `Level ${userLevel + 1} requires ${interaction.client.loyalty.getXpForLevel(userLevel + 1).toLocaleString()} total XP` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    },
};