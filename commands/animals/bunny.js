module.exports = {
    name: 'bunny',
    description: 'Display a random picture of a bunny.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://api.bunnies.io/v2/loop/random/?media=gif,png')
            .end((err, response) => {
                message.channel.send(response.body.media.poster);
            });
    },
};