const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comfort')
        .setDescription('Comfort someone.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to comfort')
                .setRequired(true)),
    guildOnly: true,
    async execute(interaction) {
        const user = interaction.options.getUser('target');

        await interaction.client.loyalty.addXp(25, interaction.user, interaction.guild);

        return interaction.reply(`${interaction.user.username} comforts ${user} (ｏ・\\_・)ノ”(ᴗ\\_ ᴗ。)`);
    },
};