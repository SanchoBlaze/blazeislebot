const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit coins from your wallet to your bank')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to deposit (or "all" for all coins)')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const amount = interaction.options.getInteger('amount');

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            
            // Check if user wants to deposit all
            let depositAmount = amount;
            if (amount >= user.balance) {
                depositAmount = user.balance;
            }

            if (depositAmount <= 0) {
                return interaction.reply({ 
                    content: 'You don\'t have any coins to deposit!', 
                    ephemeral: true 
                });
            }

            const result = interaction.client.economy.deposit(userId, guildId, depositAmount);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏦 Deposit Successful!')
                .setDescription(`You deposited **${interaction.client.economy.formatCurrency(depositAmount)}** to your bank`)
                .addFields(
                    { name: '💵 New Wallet Balance', value: interaction.client.economy.formatCurrency(result.balance), inline: true },
                    { name: '🏦 New Bank Balance', value: interaction.client.economy.formatCurrency(result.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(result.balance + result.bank), inline: true }
                )
                .setFooter({ text: 'Your money is safe in the bank!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            if (error.message === 'Insufficient funds') {
                const user = interaction.client.economy.getUser(userId, guildId);
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ Deposit Failed')
                    .setDescription(`You don't have enough coins to deposit!`)
                    .addFields(
                        { name: '💵 Your Wallet Balance', value: interaction.client.economy.formatCurrency(user.balance), inline: true },
                        { name: '💰 Deposit Amount', value: interaction.client.economy.formatCurrency(amount), inline: true }
                    )
                    .setFooter({ text: 'Make sure you have enough coins in your wallet!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                console.error('Error in deposit command:', error);
                await interaction.reply({ 
                    content: 'There was an error processing your deposit!', 
                    ephemeral: true 
                });
            }
        }
    },
}; 