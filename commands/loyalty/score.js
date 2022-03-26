const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('score')
        .setDescription('Get the score tagged user, or your own score.')
        .addUserOption(option => option.setName('target').setDescription('The user to show score for.')),
    async execute(interaction) {
        let reply = 'Your score is: ';

        let user = interaction.options.getUser('target');

        if (user) {
            reply = `${user.username}'s score is: `;
        }
        else {
            user = interaction.user;
        }

        let userScore = interaction.client.getScore.get(user.id, interaction.guild.id);

        if (!userScore) {
            userScore = { id: `${interaction.guild.id}-${user.id}`, user: user.id, guild: interaction.guild.id, points: 0, level: 1 };
            interaction.client.setScore.run(userScore);
        }

        return interaction.reply(`${reply} ${userScore.points}`);
    },
};