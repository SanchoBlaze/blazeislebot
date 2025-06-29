const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer coins to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to transfer coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to transfer')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const fromUserId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Prevent self-transfer
        if (targetUser.id === fromUserId) {
            return interaction.reply({ 
                content: 'You cannot transfer coins to yourself!', 
                ephemeral: true 
            });
        }

        try {
            await interaction.client.economy.transfer(fromUserId, targetUser.id, guildId, amount);
            
            const fromUser = interaction.client.economy.getUser(fromUserId, guildId);
            const toUser = interaction.client.economy.getUser(targetUser.id, guildId);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💸 Transfer Successful!')
                .setDescription(`You transferred **${interaction.client.economy.formatCurrency(amount)}** to ${targetUser}`)
                .addFields(
                    { name: '💵 Your New Balance', value: interaction.client.economy.formatCurrency(fromUser.balance), inline: true },
                    { name: `💵 ${targetUser.username}'s Balance`, value: interaction.client.economy.formatCurrency(toUser.balance), inline: true }
                )
                .setFooter({ text: 'Transfer completed successfully!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            if (error.message === 'Insufficient funds') {
                const user = interaction.client.economy.getUser(fromUserId, guildId);
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ Transfer Failed')
                    .setDescription(`You don't have enough coins to complete this transfer!`)
                    .addFields(
                        { name: '💵 Your Balance', value: interaction.client.economy.formatCurrency(user.balance), inline: true },
                        { name: '💰 Transfer Amount', value: interaction.client.economy.formatCurrency(amount), inline: true }
                    )
                    .setFooter({ text: 'Make sure you have enough coins in your wallet!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                console.error('Error in transfer command:', error);
                await interaction.reply({ 
                    content: 'There was an error processing the transfer!', 
                    ephemeral: true 
                });
            }
        }
    },
}; 