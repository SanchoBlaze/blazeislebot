const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the economy shop'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            const items = interaction.client.inventory.getAllItems();
            
            if (items.length === 0) {
                return interaction.reply({ 
                    content: 'No items available in the shop!', 
                    ephemeral: true 
                });
            }

            let description = '**Available Items:**\n\n';
            
            for (const item of items) {
                const canAfford = user.balance >= item.price;
                const status = canAfford ? '✅' : '❌';
                const rarityEmoji = interaction.client.inventory.getRarityEmoji(item.rarity);
                const rarityName = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
                
                description += `${status} ${rarityEmoji} **${item.name}** - ${interaction.client.economy.formatCurrency(item.price)}\n`;
                description += `└ ${rarityName} • ${item.description}\n\n`;
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
            for (let i = 0; i < Math.min(items.length, 5); i++) {
                const item = items[i];
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
        const item = interaction.client.inventory.getItem(itemId);
        
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

            // Check if user already has the item and if there's a quantity limit
            const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, itemId);
            if (currentQuantity >= item.max_quantity) {
                await interaction.reply({ 
                    content: `You already have the maximum quantity of ${item.name}! (${item.max_quantity})`, 
                    ephemeral: true 
                });
                return true;
            }

            // Process the purchase
            const success = interaction.client.inventory.addItem(userId, guildId, itemId, 1);
            
            if (success) {
                // Deduct coins and log transaction
                interaction.client.economy.updateBalance(userId, guildId, -item.price, 'balance');
                interaction.client.economy.logTransaction(userId, guildId, 'shop_purchase', -item.price, `Purchased ${item.name}`);
                
                const rarityEmoji = interaction.client.inventory.getRarityEmoji(item.rarity);
                const embed = new EmbedBuilder()
                    .setColor(interaction.client.inventory.getRarityColor(item.rarity))
                    .setTitle('🛒 Purchase Successful!')
                    .setDescription(`You purchased **${rarityEmoji} ${item.name}** for ${interaction.client.economy.formatCurrency(item.price)}`)
                    .addFields(
                        { name: '📦 Item Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                        { name: '⭐ Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true },
                        { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(user.balance - item.price), inline: true }
                    )
                    .setFooter({ text: 'Use /inventory to view your items, /use to use them!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ 
                    content: 'There was an error processing your purchase!', 
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