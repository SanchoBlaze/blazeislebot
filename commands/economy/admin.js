const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy-admin')
        .setDescription('Admin commands for managing the economy')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add coins to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add coins to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove coins from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove coins from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a user\'s balance')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set balance for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('New balance amount')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show economy statistics for the server')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'add': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            ephemeral: true 
                        });
                    }

                    const newBalance = interaction.client.economy.updateBalance(user.id, guildId, amount, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_add', amount, `Admin addition by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Coins Added')
                        .setDescription(`Added **${interaction.client.economy.formatCurrency(amount)}** to ${user}`)
                        .addFields(
                            { name: '💰 Amount Added', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'remove': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            ephemeral: true 
                        });
                    }

                    const currentUser = interaction.client.economy.getUser(user.id, guildId);
                    if (currentUser.balance < amount) {
                        return interaction.reply({ 
                            content: `User only has ${interaction.client.economy.formatCurrency(currentUser.balance)}!`, 
                            ephemeral: true 
                        });
                    }

                    const newBalance = interaction.client.economy.updateBalance(user.id, guildId, -amount, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_remove', -amount, `Admin removal by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ Coins Removed')
                        .setDescription(`Removed **${interaction.client.economy.formatCurrency(amount)}** from ${user}`)
                        .addFields(
                            { name: '💰 Amount Removed', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true }
                        )
                        .setFooter({ text: `Removed by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'set': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount < 0) {
                        return interaction.reply({ 
                            content: 'Amount cannot be negative!', 
                            ephemeral: true 
                        });
                    }

                    const currentUser = interaction.client.economy.getUser(user.id, guildId);
                    const difference = amount - currentUser.balance;
                    
                    interaction.client.economy.updateBalance(user.id, guildId, difference, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_set', difference, `Admin balance set by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('⚙️ Balance Set')
                        .setDescription(`Set ${user}'s balance to **${interaction.client.economy.formatCurrency(amount)}**`)
                        .addFields(
                            { name: '💰 New Balance', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '📊 Change', value: difference >= 0 ? `+${difference}` : difference.toString(), inline: true }
                        )
                        .setFooter({ text: `Set by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'stats': {
                    const stats = interaction.client.economy.getStats(guildId);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('📊 Economy Statistics')
                        .addFields(
                            { name: '👥 Total Users', value: stats.total_users.toString(), inline: true },
                            { name: '💵 Total Wallet Balance', value: interaction.client.economy.formatCurrency(stats.total_balance), inline: true },
                            { name: '🏦 Total Bank Balance', value: interaction.client.economy.formatCurrency(stats.total_bank), inline: true },
                            { name: '📈 Total Earned', value: interaction.client.economy.formatCurrency(stats.total_earned), inline: true },
                            { name: '📉 Total Spent', value: interaction.client.economy.formatCurrency(stats.total_spent), inline: true },
                            { name: '📊 Average Balance', value: interaction.client.economy.formatCurrency(stats.avg_balance), inline: true }
                        )
                        .setFooter({ text: `Server: ${interaction.guild.name}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('Error in economy-admin command:', error);
            await interaction.reply({ 
                content: 'There was an error processing the admin command!', 
                ephemeral: true 
            });
        }
    },
}; 