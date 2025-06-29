const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Define shop items
const shopItems = [
    {
        id: 'role_1',
        name: 'Bronze Role',
        description: 'Get a special bronze role in the server',
        price: 1000,
        type: 'role',
        roleId: null // Will be set by admin
    },
    {
        id: 'role_2',
        name: 'Silver Role',
        description: 'Get a special silver role in the server',
        price: 2500,
        type: 'role',
        roleId: null
    },
    {
        id: 'role_3',
        name: 'Gold Role',
        description: 'Get a special gold role in the server',
        price: 5000,
        type: 'role',
        roleId: null
    },
    {
        id: 'custom_color',
        name: 'Custom Color Role',
        description: 'Get a custom colored role',
        price: 3000,
        type: 'custom_role'
    },
    {
        id: 'xp_boost',
        name: 'XP Boost (1 hour)',
        description: 'Get 2x XP for 1 hour',
        price: 500,
        type: 'xp_boost'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the economy shop'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            
            let description = '**Available Items:**\n\n';
            
            for (const item of shopItems) {
                const canAfford = user.balance >= item.price;
                const status = canAfford ? '✅' : '❌';
                description += `${status} **${item.name}** - ${interaction.client.economy.formatCurrency(item.price)}\n`;
                description += `└ ${item.description}\n\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏪 Economy Shop')
                .setDescription(description)
                .addFields(
                    { name: '💵 Your Balance', value: interaction.client.economy.formatCurrency(user.balance), inline: true },
                    { name: '🏦 Bank Balance', value: interaction.client.economy.formatCurrency(user.bank), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(user.balance + user.bank), inline: true }
                )
                .setFooter({ text: 'Click the buttons below to purchase items' })
                .setTimestamp();

            // Create buttons for quick purchases
            const buttons = [];
            for (let i = 0; i < Math.min(shopItems.length, 5); i++) {
                const item = shopItems[i];
                const canAfford = user.balance >= item.price;
                
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`buy_${item.id}`)
                        .setLabel(`Buy ${item.name}`)
                        .setStyle(canAfford ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(!canAfford)
                );
            }

            const row = new ActionRowBuilder().addComponents(buttons);

            await interaction.reply({ 
                embeds: [embed], 
                components: buttons.length > 0 ? [row] : [],
                ephemeral: false 
            });
        } catch (error) {
            console.error('Error in shop command:', error);
            await interaction.reply({ 
                content: 'There was an error loading the shop!', 
                ephemeral: true 
            });
        }
    },

    // Handle button interactions for shop purchases
    async handleButtonInteraction(interaction) {
        if (!interaction.isButton()) return false;
        
        const customId = interaction.customId;
        if (!customId.startsWith('buy_')) return false;

        const itemId = customId.replace('buy_', '');
        const item = shopItems.find(i => i.id === itemId);
        
        if (!item) {
            await interaction.reply({ 
                content: 'Item not found!', 
                ephemeral: true 
            });
            return true;
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            
            if (user.balance < item.price) {
                await interaction.reply({ 
                    content: `You don't have enough coins! You need ${interaction.client.economy.formatCurrency(item.price)}.`, 
                    ephemeral: true 
                });
                return true;
            }

            // Process the purchase based on item type
            let success = false;
            let message = '';

            switch (item.type) {
                case 'role':
                    // For now, just give them the coins back as a placeholder
                    // In a real implementation, you'd add the role here
                    message = `Role purchase feature coming soon! For now, you can use /economy-admin add to get your coins back.`;
                    success = false;
                    break;
                    
                case 'custom_role':
                    message = `Custom role feature coming soon! For now, you can use /economy-admin add to get your coins back.`;
                    success = false;
                    break;
                    
                case 'xp_boost':
                    message = `XP boost feature coming soon! For now, you can use /economy-admin add to get your coins back.`;
                    success = false;
                    break;
                    
                default:
                    message = `Unknown item type: ${item.type}`;
                    success = false;
            }

            if (success) {
                // Deduct coins and log transaction
                interaction.client.economy.updateBalance(userId, guildId, -item.price, 'balance');
                interaction.client.economy.logTransaction(userId, guildId, 'shop_purchase', -item.price, `Purchased ${item.name}`);
                
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🛒 Purchase Successful!')
                    .setDescription(`You purchased **${item.name}** for ${interaction.client.economy.formatCurrency(item.price)}`)
                    .setFooter({ text: 'Thank you for your purchase!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ 
                    content: message, 
                    ephemeral: true 
                });
            }

            return true;
        } catch (error) {
            console.error('Error processing shop purchase:', error);
            await interaction.reply({ 
                content: 'There was an error processing your purchase!', 
                ephemeral: true 
            });
            return true;
        }
    }
}; 