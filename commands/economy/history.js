const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Show your transaction history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check history for (optional)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of transactions to show (1-20)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        const limit = interaction.options.getInteger('limit') || 10;

        try {
            const transactions = interaction.client.economy.getTransactionHistory(targetUser.id, guildId, limit);
            
            if (transactions.length === 0) {
                return interaction.reply({ 
                    content: 'No transaction history found!', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            let description = '';
            for (const transaction of transactions) {
                const date = new Date(transaction.created_at).toLocaleDateString();
                const time = new Date(transaction.created_at).toLocaleTimeString();
                const amount = transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount;
                const emoji = transaction.amount > 0 ? '💰' : '💸';
                
                description += `${emoji} **${transaction.description}** - ${amount} coins\n`;
                description += `📅 ${date} at ${time}\n\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📊 ${targetUser.username}'s Transaction History`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(description)
                .setFooter({ text: `Showing last ${transactions.length} transactions` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Error in history command:', error);
            await interaction.reply({ content: 'There was an error fetching your transaction history!', flags: MessageFlags.Ephemeral });
        }
    },
}; 