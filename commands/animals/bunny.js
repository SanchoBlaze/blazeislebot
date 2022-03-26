const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bunny')
        .setDescription('Display a random picture of a bunny 🐰.'),
    execute(interaction) {
        const sa = require('superagent');
        sa.get('https://api.bunnies.io/v2/loop/random/?media=gif,png')
            .end((err, response) => {
                return interaction.reply(response.body.media.poster);
            });
    },
};