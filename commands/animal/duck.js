const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duck')
        .setDescription('Display a random picture of a duck 🦆.'),
    async execute(interaction) {

        if(interaction.guild !== null) {
            await interaction.client.loyalty.addXp(1, interaction.user, interaction.guild);
        }

        const sa = require('superagent');
        sa.get('https://random-d.uk/api/v2/random')
            .end((err, response) => {
                interaction.reply(response.body.url);
            });
    },
};