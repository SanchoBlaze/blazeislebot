module.exports = {
    name: 'hug',
    description: 'Send hug(s).',
    args: true,
    execute(message) {
        if (!message.mentions.users.size) {
            return message.channel.send('"Please mention one or more users!');
        }

        const hugList = message.mentions.users.map(user => {
            return `${message.author.toString()} hugs ${user.toString()} :people_hugging:`;
        });

        message.channel.send(hugList);
    },
};