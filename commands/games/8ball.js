const Discord = require('discord.js');

module.exports = {
    name: '8ball',
    description: 'Ask the magic 8 ball a question.',
    execute(message, args) {
        if (!args[0]) return message.reply('Please ask a question!');
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

        const question = args.slice().join(' ');

        const embed = new Discord.MessageEmbed()
            .setAuthor(message.author.username + ' asks: ' + question)
            .addField('Answer', replies[result] + '');

        message.channel.send(embed);
    },
};