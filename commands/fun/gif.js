const config = require('config');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const giphy = require('giphy-api')(config.get('Giphy.key'));
const path = require('path');
const imagePath = path.join(__dirname, '..', '..', 'assets', 'giphy.gif');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Display a random gif based on your search term. Powered by GIPHY')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search term.')
                .setRequired(true)),
    async execute(interaction) {
        const attachment = new AttachmentBuilder(imagePath);
        const search = interaction.options.getString('search');
        await interaction.reply({ content: `Searched for: ${search}`, files: [attachment] });

        giphy.random({
            tag: search,
            rating: 'pg-13',
            fmt: 'json',
        }, function(error, response) {
            interaction.followUp(response.data.url);
        });
    },
};