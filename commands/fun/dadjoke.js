const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Tells you a dad joke.'),
    async execute(interaction) {
        const sa = require('superagent');
        sa.get('https://icanhazdadjoke.com/slack')
            .end((err, response) => {
                interaction.reply(response.body.attachments[0].text);
            });
    },
};