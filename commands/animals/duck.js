const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duck')
        .setDescription('Display a random picture of a duck.'),
    async execute(interaction) {
        const sa = require('superagent');
        sa.get('https://random-d.uk/api/v2/random')
            .end((err, response) => {
                interaction.reply(response.body.url);
            });
    },
};