const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Hug someone :people_hugging:.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to hug')
                .setRequired(true)),
    guildOnly: true,
    async execute(interaction) {
        const user = interaction.options.getUser('target');

        await interaction.client.loyalty.addXp(25, interaction.user, interaction.guild);

        return interaction.reply(`${interaction.user.username} hugs ${user} :people_hugging:`);
    },
};