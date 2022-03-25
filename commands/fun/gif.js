const { SlashCommandBuilder } = require('@discordjs/builders');
const giphy = require('giphy-api')('MinvYb8r3K6yKZQmbKggyIM1HmgkihRP');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Display a random gif based on your search term.')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search term.')
                .setRequired(true)),
    execute(interaction) {
        const search = interaction.options.getString('search');
        console.log(search);
        giphy.random({
            tag: search,
            rating: 'pg-13',
            fmt: 'json',
        }, function(error, response) {
            return interaction.reply('Search: ' + search + ' ' + response.data.url);
        });
    },
};