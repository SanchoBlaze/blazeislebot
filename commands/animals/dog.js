module.exports = {
    name: 'dog',
    description: 'Display a random picture of a dog.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://dog.ceo/api/breeds/image/random')
            .end((err, response) => {
                message.channel.send(response.body.message);
            });
    },
};