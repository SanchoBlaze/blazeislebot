const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Hug someone :people_hugging:.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to hug')
                .setRequired(true)),
    execute(interaction) {
        const user = interaction.options.getUser('target');
        return interaction.reply(`${interaction.user.username} hugs ${user} :people_hugging:`);
    },
};