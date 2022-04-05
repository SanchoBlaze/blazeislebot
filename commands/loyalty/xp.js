const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Get the xp of the tagged user, or your own xp.')
        .addUserOption(option => option.setName('target').setDescription('The user to show xp for.')),
    async execute(interaction) {
        let reply = 'Your xp is: ';

        let user = interaction.options.getUser('target');

        if (user) {
            reply = `${user.username}'s xp is: `;
        }
        else {
            user = interaction.user;
        }

        const userXp = interaction.client.loyalty.getXp(user, interaction.guild);

        return interaction.reply(`${reply} ${userXp}`);
    },
};