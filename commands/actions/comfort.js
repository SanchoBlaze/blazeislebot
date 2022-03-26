const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comfort')
        .setDescription('Comfort someone.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to comfort')
                .setRequired(true)),
    execute(interaction) {
        const user = interaction.options.getUser('target');

        let score = interaction.client.getScore.get(user.id, interaction.guild.id);
        if (!score) {
            score = { id: `${interaction.guild.id}-${user.id}`, user: user.id, guild: interaction.guild.id, points: 0, level: 1 };
        }
        score.points += 25;
        interaction.client.setScore.run(score);

        return interaction.reply(`${interaction.user.username} comforts ${user} (ｏ・\\_・)ノ”(ᴗ\\_ ᴗ。)`);
    },
};