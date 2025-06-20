const { SlashCommandBuilder } = require('discord.js');
const { getUser, updateBalance } = require('../../src/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money into your bank')
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to deposit (use "all" for everything)')
                .setRequired(true)),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guildId);
        let amount = interaction.options.getString('amount');

        if (amount.toLowerCase() === 'all') {
            amount = user.wallet;
        } else {
            amount = parseInt(amount);
            if (isNaN(amount) || amount <= 0) {
                return interaction.reply({ content: 'Please provide a valid positive number!', ephemeral: true });
            }
        }

        if (amount > user.wallet) {
            return interaction.reply({ content: 'You don\'t have that much money in your wallet!', ephemeral: true });
        }

        await updateBalance(interaction.user.id, interaction.guildId, -amount, amount);
        
        await interaction.reply({
            embeds: [{
                color: 0x00ff00,
                description: `Successfully deposited $${amount.toLocaleString()} into your bank!`,
                timestamp: new Date()
            }]
        });
    }
}; 