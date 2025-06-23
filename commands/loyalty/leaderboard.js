const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Our top 10 XP leaders!'),
    async execute(interaction) {
        const top10 = interaction.client.loyalty.getLeaders(interaction.guild);

        const members = await interaction.guild.members.fetch();

        // Now shake it and show it! (as a nice embed, too!)
        const embed = new EmbedBuilder()
            .setTitle(interaction.guild.name + ' Leader board')
            .setDescription('Our top 10 XP leaders!')
            .setColor(Colours.LIGHT_GREEN);

        for (const data of top10) {
            const member = members.find(member => member.id === data.user);
            const username = member ? member.user.username : `Unknown User (${data.user})`;
            embed.addFields({ name: username, value: `${data.xp} XP (level ${data.level})` });
        }

        return interaction.reply({ embeds: [embed] });
    },
};