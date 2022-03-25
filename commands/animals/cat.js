const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cat')
        .setDescription('Display a random picture of a cat.'),
    async execute(interaction) {
        const sa = require('superagent');
        sa.get('https://cataas.com/cat?json=true')
            .end((err, response) => {
                interaction.reply('https://cataas.com' + response.body.url);
            });
    },
};