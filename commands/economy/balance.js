const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../src/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check balance for')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = await getUser(targetUser.id, interaction.guildId);

        await interaction.reply({
            embeds: [{
                color: 0x0099ff,
                title: `${targetUser.username}'s Balance`,
                fields: [
                    { name: 'Wallet', value: `$${userData.wallet.toLocaleString()}`, inline: true },
                    { name: 'Bank', value: `$${userData.bank.toLocaleString()}`, inline: true },
                    { name: 'Total', value: `$${(userData.wallet + userData.bank).toLocaleString()}`, inline: true }
                ],
                timestamp: new Date()
            }]
        });
    }
}; 