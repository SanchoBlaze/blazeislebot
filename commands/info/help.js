const Discord = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    name: 'help',
    aliases: ['h'],
    description: 'Display all commands and descriptions',
    execute(message) {
        const commands = message.client.commands.array();

        const helpEmbed = new Discord.MessageEmbed()
            .setTitle(`${message.client.user.username} Help`)
            .setDescription('List of all commands')
            .setColor(Colours.LIGHT_ORANGE);

        commands.forEach((cmd) => {
            helpEmbed.addField(
                `**${message.client.prefix}${cmd.name} ${cmd.aliases ? `(${cmd.aliases})` : ''}**`,
                `${cmd.description}`,
                true,
            );
        });

        helpEmbed.setTimestamp();

        message.channel.send(helpEmbed);
    },
};