const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bunny')
        .setDescription('Display a random picture of a bunny 🐰.'),
    execute(interaction) {

        let score = interaction.client.getScore.get(interaction.user.id, interaction.guild.id);
        if (!score) {
            score = { id: `${interaction.guild.id}-${interaction.user.id}`, user: interaction.user.id, guild: interaction.guild.id, points: 0, level: 1 };
        }
        score.points += 1;
        interaction.client.setScore.run(score);

        const sa = require('superagent');
        sa.get('https://api.bunnies.io/v2/loop/random/?media=gif,png')
            .end((err, response) => {
                return interaction.reply(response.body.media.poster);
            });
    },
};