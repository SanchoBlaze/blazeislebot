module.exports = {
    name: 'comfort',
    description: 'Comfort one or more people.',
    args: true,
    execute(message) {
        if (!message.mentions.users.size) {
            return message.channel.send('"Please mention one or more people!');
        }

        const comfortList = message.mentions.users.map(user => {
            return `${message.author.toString()} comforts ${user.toString()} (ｏ・\\_・)ノ”(ᴗ\\_ ᴗ。)`;
        });

        message.channel.send(comfortList);
    },
};