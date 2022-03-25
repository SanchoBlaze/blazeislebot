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
        return interaction.reply(`${interaction.user.username} comforts ${user} (ｏ・\\_・)ノ”(ᴗ\\_ ᴗ。)`);
    },
};