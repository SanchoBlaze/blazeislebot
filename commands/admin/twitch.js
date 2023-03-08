const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch EventSub.')
        .addUserOption(option => option.setName('target').setDescription('The user\'s avatar to show')),
    role: 'Blaze Isle Bot Admin',
    guildOnly: true,
    async execute(interaction) {


        const user = interaction.options.getUser('target');
        if (user) return interaction.reply(`${user.username}'s avatar: ${user.displayAvatarURL({ dynamic: true })}`);
        return interaction.reply(`Your avatar: ${interaction.user.displayAvatarURL({ dynamic: true })}`);
    },
};