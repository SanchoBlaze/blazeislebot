const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the economy shop')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view')
                .setRequired(false)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const page = interaction.options.getInteger('page') || 1;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            const allItems = interaction.client.inventory.getAllItems(guildId);
            
            if (allItems.length === 0) {
                return interaction.reply({ 
                    content: 'No items available in the shop! Use `/economy-admin populate-defaults` to add default items.', 
                    ephemeral: true 
                });
            }

            // Pagination settings
            const itemsPerPage = 8;
            const totalPages = Math.ceil(allItems.length / itemsPerPage);
            const currentPage = Math.max(1, Math.min(page, totalPages));
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = allItems.slice(startIndex, endIndex);

            let description = `**Available Items (Page ${currentPage}/${totalPages}):**\n\n`;
            
            for (const item of pageItems) {
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
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(user.balance + user.bank), inline: true },
                    { name: '📦 Total Items', value: allItems.length.toString(), inline: true },
                    { name: '📄 Page', value: `${currentPage}/${totalPages}`, inline: true },
                    { name: '🛒 How to Buy', value: 'Use the dropdown menu below', inline: true }
                )
                .setFooter({ text: `Use /shop <page> to navigate pages` })
                .setTimestamp();

            // Create components
            const components = [];

            // Create dropdown menu for item selection
            if (pageItems.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`shop_select_${currentPage}`)
                    .setPlaceholder('Select an item to purchase...')
                    .addOptions(
                        pageItems.map(item => {
                            const canAfford = user.balance >= item.price;
                            const rarityEmoji = interaction.client.inventory.getRarityEmoji(item.rarity);
                            
                            return {
                                label: `${item.name} - ${interaction.client.economy.formatCurrency(item.price)}`,
                                description: canAfford ? `${rarityEmoji} ${item.description.substring(0, 50)}...` : `❌ Insufficient funds`,
                                value: item.id,
                                emoji: canAfford ? '🛒' : '❌',
                                default: false
                            };
                        })
                    );

                const selectRow = new ActionRowBuilder().addComponents(selectMenu);
                components.push(selectRow);
            }

            // Create pagination buttons
            const paginationRow = new ActionRowBuilder();
            
            if (totalPages > 1) {
                // Previous page button
                const prevButton = new ButtonBuilder()
                    .setCustomId(`shop_prev_${currentPage}`)
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage <= 1);

                // Next page button
                const nextButton = new ButtonBuilder()
                    .setCustomId(`shop_next_${currentPage}`)
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages);

                // Page indicator button
                const pageButton = new ButtonBuilder()
                    .setCustomId('shop_page_info')
                    .setLabel(`Page ${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                paginationRow.addComponents(prevButton, pageButton, nextButton);
                components.push(paginationRow);
            }

            await interaction.reply({ 
                embeds: [embed], 
                components: components,
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

    // Handle button and select menu interactions for shop
    async handleButtonInteraction(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
        
        const customId = interaction.customId;
        
        // Handle pagination
        if (customId.startsWith('shop_prev_') || customId.startsWith('shop_next_')) {
            const currentPage = parseInt(customId.split('_')[2]);
            const newPage = customId.startsWith('shop_prev_') ? currentPage - 1 : currentPage + 1;
            
            // Re-run the shop command with the new page
            const command = interaction.client.commands.get('shop');
            if (command) {
                // Create a mock interaction with the page option
                const mockInteraction = {
                    ...interaction,
                    options: {
                        getInteger: (name) => name === 'page' ? newPage : null
                    }
                };
                await command.execute(mockInteraction);
            }
            return true;
        }

        // Handle item selection
        if (customId.startsWith('shop_select_')) {
            const selectedItemId = interaction.values[0];
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            try {
                const item = interaction.client.inventory.getItem(selectedItemId, guildId);
                
                if (!item) {
                    await interaction.reply({ 
                        content: 'Item not found!', 
                        ephemeral: true 
                    });
                    return true;
                }

                const user = interaction.client.economy.getUser(userId, guildId);
                
                if (user.balance < item.price) {
                    await interaction.reply({ 
                        content: `You don't have enough coins! You need ${interaction.client.economy.formatCurrency(item.price)}.`, 
                        ephemeral: true 
                    });
                    return true;
                }

                // Check if user already has the item and if there's a quantity limit
                const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, selectedItemId);
                if (currentQuantity >= item.max_quantity) {
                    await interaction.reply({ 
                        content: `You already have the maximum quantity of ${item.name}! (${item.max_quantity})`, 
                        ephemeral: true 
                    });
                    return true;
                }

                // Process the purchase
                const success = interaction.client.inventory.addItem(userId, guildId, selectedItemId, 1);
                
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

        return false;
    }
}; 