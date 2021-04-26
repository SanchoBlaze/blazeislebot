module.exports = {
    name: 'cat',
    description: 'Display a random picture of a cat.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://cataas.com/cat?json=true')
            .end((err, response) => {
                message.channel.send('https://cataas.com' + response.body.url);
            });
    },
};