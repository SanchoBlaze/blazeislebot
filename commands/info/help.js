const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all commands and descriptions.'),
    execute(interaction) {
        const commands = interaction.client.commands;

        const helpEmbed = new Discord.MessageEmbed()
            .setTitle(`${interaction.client.user.username} Help`)
            .setDescription('List of all commands')
            .setColor(Colours.LIGHT_ORANGE);

        commands.forEach((cmd) => {
            helpEmbed.addField(
                `**/${cmd.data.name}**`,
                `${cmd.data.description}`,
                true,
            );
        });

        helpEmbed.setTimestamp();

        return interaction.reply({ embeds: [helpEmbed] });
    },
};