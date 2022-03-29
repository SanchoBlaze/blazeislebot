const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');

Object.defineProperty(String.prototype, 'ucfirst', {
    value: function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    },
    enumerable: false,
});

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

        // let lastCategory = '';

        commands.forEach((cmd) => {
            /*
            const category = cmd.category.ucfirst();
            console.log(category);

            if (category !== lastCategory) {
                helpEmbed.addField('\u200B', '\u200B');
                helpEmbed.addField(`**${category}**`, `${category} commands.`);
                lastCategory = category;
            }
            */
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