const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the economy shop'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            const allItems = interaction.client.inventory.getAllItems(guildId);
            
            if (allItems.length === 0) {
                return interaction.reply({ 
                    content: 'No items available in the shop! Use `/economy-admin populate-defaults` to add default items.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Create pages of items with components
            const itemsPerPage = 8;
            const pages = [];
            
            for (let i = 0; i < allItems.length; i += itemsPerPage) {
                const pageItems = allItems.slice(i, i + itemsPerPage);
                const pageNumber = Math.floor(i / itemsPerPage) + 1;
                const totalPages = Math.ceil(allItems.length / itemsPerPage);
                
                let description = `**Available Items (Page ${pageNumber}/${totalPages}):**\n\n`;
                
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
                        { name: '📄 Page', value: `${pageNumber}/${totalPages}`, inline: true },
                        { name: '🛒 How to Buy', value: 'Use the dropdown menu below', inline: true }
                    )
                    .setFooter({ text: 'Use the arrow buttons to navigate pages' })
                    .setTimestamp();

                // Create dropdown menu for item selection
                const components = [];
                if (pageItems.length > 0) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`shop_select_${pageNumber}`)
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

                pages.push({ embed, components });
            }

            // Use custom shop paginator
            await this.shopPaginator(interaction, pages);
            
        } catch (error) {
            console.error('Error in shop command:', error);
            await interaction.reply({ 
                content: 'There was an error loading the shop!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    async shopPaginator(interaction, pages) {
        if (pages.length === 1) {
            return interaction.reply({ 
                embeds: [pages[0].embed], 
                components: pages[0].components,
                flags: MessageFlags.Ephemeral
            });
        }

        let page = 0;
        const getButtons = () => new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_leftPaginationButton')
                    .setLabel('🡠')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('shop_rightPaginationButton')
                    .setLabel('🡢')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === pages.length - 1)
            );

        const allComponents = [...pages[page].components, getButtons()];
        await interaction.reply({ 
            embeds: [pages[page].embed], 
            components: allComponents,
            flags: MessageFlags.Ephemeral
        });
        
        const message = await interaction.fetchReply();
        
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000 // 1 minute
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'You cannot use this button.', flags: MessageFlags.Ephemeral });
            }
            
            await i.deferUpdate();

            if (i.customId === 'shop_leftPaginationButton') {
                page = page > 0 ? --page : pages.length - 1;
            } else if (i.customId === 'shop_rightPaginationButton') {
                page = page + 1 < pages.length ? ++page : 0;
            }
            
            const allComponents = [...pages[page].components, getButtons()];
            await i.editReply({ 
                embeds: [pages[page].embed], 
                components: allComponents,
                flags: MessageFlags.Ephemeral
            });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop_leftPaginationButton')
                        .setLabel('🡠')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('shop_rightPaginationButton')
                        .setLabel('🡢')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            
            // Keep the dropdown menu but disable pagination buttons
            const finalComponents = [...pages[page].components, disabledRow];
            interaction.editReply({ components: finalComponents, flags: MessageFlags.Ephemeral });
        });
    },

    // Handle select menu interactions for shop purchases
    async handleButtonInteraction(interaction) {
        if (!interaction.isStringSelectMenu()) return false;
        
        const customId = interaction.customId;
        
        // Handle item selection
        if (customId.startsWith('shop_select_')) {
            const selectedItemId = interaction.values[0];
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            try {
                console.log(`[shop purchase] User ${userId} attempting to buy item ${selectedItemId} (interaction id: ${interaction.id})`);
                const item = interaction.client.inventory.getItem(selectedItemId, guildId);
                
                if (!item) {
                    await interaction.reply({ 
                        content: 'Item not found!', 
                        flags: MessageFlags.Ephemeral 
                    });
                    return true;
                }

                const user = interaction.client.economy.getUser(userId, guildId);
                
                if (user.balance < item.price) {
                    await interaction.reply({ 
                        content: `You don't have enough coins! You need ${interaction.client.economy.formatCurrency(item.price)}.`, 
                        flags: MessageFlags.Ephemeral 
                    });
                    return true;
                }

                // Check if user already has the item and if there's a quantity limit
                const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, selectedItemId);
                if (currentQuantity >= item.max_quantity) {
                    await interaction.reply({ 
                        content: `You already have the maximum quantity of ${item.name}! (${item.max_quantity})`, 
                        flags: MessageFlags.Ephemeral 
                    });
                    return true;
                }

                // Process the purchase
                const success = interaction.client.inventory.addItem(userId, guildId, selectedItemId, 1);
                
                if (success) {
                    console.log(`[shop purchase] User ${userId} successfully bought item ${selectedItemId}`);
                    // Deduct coins and log transaction
                    interaction.client.economy.updateBalance(userId, guildId, -item.price, 'balance');
                    interaction.client.economy.logTransaction(userId, guildId, 'shop_purchase', -item.price, `Purchased ${item.name}`);
                    
                    const rarityEmoji = interaction.client.inventory.getRarityEmoji(item.rarity);
                    const embed = new EmbedBuilder()
                        .setColor(interaction.client.inventory.getRarityColour(item.rarity))
                        .setTitle('🛒 Purchase Successful!')
                        .setDescription(`You purchased **${rarityEmoji} ${item.name}** for ${interaction.client.economy.formatCurrency(item.price)}`)
                        .addFields(
                            { name: '📦 Item Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                            { name: '⭐ Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true },
                            { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(user.balance - item.price), inline: true }
                        )
                        .setFooter({ text: 'Use /inventory to view your items, /use to use them!' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ 
                        content: 'There was an error processing your purchase!', 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                return true;
            } catch (error) {
                console.error('Error processing shop purchase:', error);
                await interaction.reply({ 
                    content: 'There was an error processing your purchase!', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }
        }

        return false;
    }
}; 