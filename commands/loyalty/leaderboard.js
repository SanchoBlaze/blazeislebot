const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Our top 10 points leaders!'),
    async execute(interaction) {
        const top10 = interaction.client.sql.prepare('SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 10;').all(interaction.guild.id);

        const members = await interaction.guild.members.fetch();

        // Now shake it and show it! (as a nice embed, too!)
        const embed = new Discord.MessageEmbed()
            .setTitle(interaction.guild.name + ' Leader board')
            .setDescription('Our top 10 points leaders!')
            .setColor(Colours.LIGHT_GREEN);

        for (const data of top10) {
            embed.addFields({ name:  members.find(member => member.id === data.user).user.username, value: `${data.points} points (level ${data.level})` });
        }

        return interaction.reply({ embeds: [embed] });
    },
};