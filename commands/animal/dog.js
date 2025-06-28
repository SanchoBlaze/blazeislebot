const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dog')
        .setDescription('Display a random picture of a dog 🐶.'),
    async execute(interaction) {

        if(interaction.guild !== null) {
            await interaction.client.loyalty.addXp(3, interaction.user, interaction.guild);
        }

        const sa = require('superagent');
        sa.get('https://dog.ceo/api/breeds/image/random')
            .end((err, response) => {
                interaction.reply(response.body.message);
            });
    },
};