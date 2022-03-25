const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 🎱 ball a question.')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Question to ask the magic 🎱 ball.')
                .setRequired(true)),
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const replies = ['As I see it, yes.',
            'Ask again later.',
            'Better not tell you now.',
            'Cannot predict now.',
            'Concentrate and ask again.',
            'Don’t count on it.',
            'It is certain.',
            'It is decidedly so.',
            'Most likely.',
            'My reply is no.',
            'My sources say no.',
            'Outlook not so good.',
            'Outlook good.',
            'Reply hazy, try again.',
            'Signs point to yes.',
            'Very doubtful.',
            'Without a doubt.',
            'Yes.',
            'Yes – definitely.',
            'You may rely on it.'];
        const result = Math.floor((Math.random() * replies.length));

        const embed = new Discord.MessageEmbed()
            .setTitle(interaction.user.username + ' asks: ' + question)
            .addField('Answer', replies[result] + '')
            .setColor(Colours.DARK_COLOURLESS);

        await interaction.reply({ embeds: [embed] });
    },
};