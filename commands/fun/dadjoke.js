module.exports = {
    name: 'dadjoke',
    description: 'Tells you a dad joke.',
    execute(message) {
        const sa = require('superagent');
        sa.get('https://icanhazdadjoke.com/slack')
            .end((err, response) => {
                message.channel.send(response.body.attachments.map(a => a.text));
            });
    },
};