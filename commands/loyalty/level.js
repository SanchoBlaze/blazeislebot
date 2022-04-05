const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Get the level of the tagged user, or your own level.')
        .addUserOption(option => option.setName('target').setDescription('The user to show level for.')),
    async execute(interaction) {

        let reply = 'Your level is: ';

        let user = interaction.options.getUser('target');

        if (user) {
            reply = `${user.username}'s level is: `;
        }
        else {
            user = interaction.user;
        }

        const userLevel = interaction.client.loyalty.getLevel(user, interaction.guild);

        return interaction.reply(`${reply} ${userLevel}`);
    },
};