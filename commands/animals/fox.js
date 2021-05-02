module.exports = {
    name: 'fox',
    description: 'Display a random picture of a fox.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://randomfox.ca/floof/')
            .end((err, response) => {
                message.channel.send(response.body.image);
            });
    },
};