const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fox')
        .setDescription('Display a random picture of a fox 🦊.'),
    async execute(interaction) {
        const sa = require('superagent');
        sa.get('https://randomfox.ca/floof/')
            .end((err, response) => {
                interaction.reply(response.body.image);
            });
    },
};