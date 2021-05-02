module.exports = {
    name: 'duck',
    description: 'Display a random picture of a duck.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://random-d.uk/api/v2/random')
            .end((err, response) => {
                message.channel.send(response.body.url);
            });
    },
};