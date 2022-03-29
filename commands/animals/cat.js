const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cat')
        .setDescription('Display a random picture of a cat 🐱.'),
    async execute(interaction) {

        if(interaction.guild !== null) {
            let score = interaction.client.getScore.get(interaction.user.id, interaction.guild.id);
            if (!score) {
                score = { id: `${interaction.guild.id}-${interaction.user.id}`, user: interaction.user.id, guild: interaction.guild.id, points: 0, level: 1 };
            }
            score.points += 1;
            interaction.client.setScore.run(score);
        }

        const sa = require('superagent');
        sa.get('https://cataas.com/cat?json=true')
            .end((err, response) => {
                interaction.reply('https://cataas.com' + response.body.url);
            });
    },
};