const giphy = require('giphy-api')('MinvYb8r3K6yKZQmbKggyIM1HmgkihRP');

module.exports = {
    name: 'gif',
    description: 'Display a random gif based on your search term.',
    args: true,
    execute(message, args) {
        if (!args[0]) return message.reply('Please enter a search term!');
        const search = args.slice().join(' ');
        giphy.random({
            tag: search,
            rating: 'pg-13',
            fmt: 'json',
        }, function(error, response) {
            message.channel.send(response.data.url);
        });
    },
};