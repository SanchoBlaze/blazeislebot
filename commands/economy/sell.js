const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell items from your inventory back to the shop'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Check if user has any items first
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            if (!inventory || inventory.length === 0) {
                return interaction.reply({
                    content: '❌ You don\'t have any items to sell! Visit the shop to buy some items first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Deduplicate items by id and variant, sum quantities
            const uniqueItems = {};
            for (const item of inventory) {
                const key = item.variant ? `${item.id}_${item.variant}` : item.id;
                if (!uniqueItems[key]) {
                    uniqueItems[key] = { ...item, variant: item.variant };
                } else {
                    uniqueItems[key].quantity += item.quantity;
                }
            }
            // Attach variants array from full item definition (config JSON)
            for (const key in uniqueItems) {
                const fullItem = interaction.client.inventory.getItemFromConfig(uniqueItems[key].id);
                if (fullItem && fullItem.variants) {
                    uniqueItems[key].variants = fullItem.variants;
                }
            }

            const allItems = Object.values(uniqueItems);
            // Sort by rarity (common < uncommon < rare < epic < legendary < mythic)
            const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
            allItems.sort((a, b) => {
                const aRank = rarityOrder[a.rarity] || 99;
                const bRank = rarityOrder[b.rarity] || 99;
                if (aRank !== bRank) return aRank - bRank;
                const aDisplayName = interaction.client.inventory.getDisplayName(a, a.variant);
                const bDisplayName = interaction.client.inventory.getDisplayName(b, b.variant);
                return aDisplayName.localeCompare(bDisplayName);
            });
            
            // Create pages with one item per page
            const pages = this.createPages(allItems, interaction.client);
            
            if (pages.length === 0) {
                return interaction.reply({
                    content: '❌ You don\'t have any items to sell! Visit the shop to buy some items first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Use custom sell paginator
            await this.sellPaginator(interaction, pages, allItems);
            
        } catch (error) {
            console.error('Error in sell command:', error);
            await interaction.reply({
                content: 'There was an error loading your inventory!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    createPages(items, client) {
        const pages = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const pageNumber = i + 1;
            const totalPages = items.length;

            const sellPercentage = client.inventory.getSellPricePercentage(item.rarity, item.type);
            const sellPrice = Math.floor(item.price * sellPercentage);
            const totalSellPrice = sellPrice * item.quantity;
            const displayName = client.inventory.getDisplayName(item, item.variant);
            const displayEmoji = client.inventory.getDisplayEmoji(item, item.variant);
            const rarityName = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
            const emojiUrl = client.inventory.getEmojiUrl(displayEmoji, client);

            const embed = new EmbedBuilder()
                .setColor(client.inventory.getRarityColour(item.rarity))
                .setTitle(`💰 ${displayName}`)
                .setDescription(item.description)
                .setThumbnail(emojiUrl)
                .addFields(
                    { name: '📦 Quantity', value: `${item.quantity}x`, inline: true },
                    { name: '💰 Sell Price', value: `${client.economy.formatCurrency(sellPrice)} each`, inline: true },
                    { name: '💵 Total Value', value: client.economy.formatCurrency(totalSellPrice), inline: true },
                    { name: '⭐ Rarity', value: rarityName, inline: true },
                    { name: '📊 Sell Rate', value: `${Math.round(sellPercentage * 100)}%`, inline: true },
                    { name: '📦 Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                    { name: '📄 Page', value: `${pageNumber}/${totalPages}`, inline: true },
                    { name: '🛒 Status', value: item.quantity > 0 ? '✅ Can sell' : '❌ Cannot sell', inline: true }
                )
                .setFooter({ text: 'Use the arrow buttons to navigate, sell button to sell items' })
                .setTimestamp();

            // Store item data for sell handling
            pages.push({ 
                embed, 
                item,
                canSell: item.quantity > 0,
                pageNumber,
                totalPages,
                sellPrice,
                totalSellPrice
            });
        }
        
        return pages;
    },

    async sellPaginator(interaction, pages, originalItems) {
        if (pages.length === 1) {
            const page = pages[0];
            const buttons = this.getButtons(page.pageNumber, page.totalPages, page.canSell);
            const filterDropdown = this.getFilterDropdown();
            return interaction.reply({ 
                embeds: [page.embed], 
                components: [filterDropdown, buttons],
                flags: MessageFlags.Ephemeral
            });
        }

        let page = 0;
        let currentPages = pages;
        const filterDropdown = this.getFilterDropdown();
        const currentPage = currentPages[page];
        const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canSell);
        
        await interaction.reply({ 
            embeds: [currentPage.embed], 
            components: [filterDropdown, buttons],
            flags: MessageFlags.Ephemeral
        });
        
        const message = await interaction.fetchReply();
        
        const collector = message.createMessageComponentCollector({
            time: 300000, // 5 minutes
            filter: i => i.user.id === interaction.user.id
        });

        collector.on('collect', async i => {
            // Handle dropdown filter
            if (i.isStringSelectMenu() && i.customId === 'sell_filterDropdown') {
                await i.deferUpdate();
                const filterType = i.values[0];
                let filteredItems = originalItems;
                if (filterType !== 'all') {
                    if (filterType === 'farming') {
                        // Group farming items: seeds, watering cans, and fertilisers
                        filteredItems = originalItems.filter(item => 
                            item.type === 'seed' || 
                            item.type === 'watering_can' || 
                            item.type === 'fertiliser'
                        );
                    } else if (filterType === 'fishing') {
                        // Group fishing items: fishing rods and fish
                        filteredItems = originalItems.filter(item => 
                            item.type === 'fishing_rod' || 
                            item.type === 'fish'
                        );
                    } else {
                        filteredItems = originalItems.filter(item => item.type === filterType);
                    }
                }
                if (filteredItems.length === 0) {
                    const noItemsEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🔍 No Items Found')
                        .setDescription(`No items found for the selected filter: **${filterType.charAt(0).toUpperCase() + filterType.slice(1)}**`)
                        .setFooter({ text: 'Try selecting a different filter' })
                        .setTimestamp();
                    await i.editReply({ 
                        embeds: [noItemsEmbed], 
                        components: [filterDropdown, this.getDisabledButtons(1, 1)]
                    });
                    return;
                }
                currentPages = this.createPages(filteredItems, interaction.client);
                page = 0;
                const newCurrentPage = currentPages[page];
                const newButtons = this.getButtons(newCurrentPage.pageNumber, newCurrentPage.totalPages, newCurrentPage.canSell);
                await i.editReply({ 
                    embeds: [newCurrentPage.embed], 
                    components: [filterDropdown, newButtons]
                });
                return;
            }
            // Handle button interactions
            if (i.isButton()) {
                if (i.customId === 'sell_quantityButton') {
                    // Show modal for quantity input (do NOT defer or edit reply)
                    const currentPage = currentPages[page];
                    const modal = new ModalBuilder()
                        .setCustomId('sell_quantityModal')
                        .setTitle('Sell Quantity')
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('sell_quantityInput')
                                    .setLabel('Enter quantity to sell')
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder(`1 - ${currentPage.item.quantity}`)
                                    .setRequired(true)
                            )
                        );
                    await i.showModal(modal);
                    return;
                } else {
                    await i.deferUpdate();
                }
                if (i.customId === 'sell_leftPaginationButton') {
                    page = page > 0 ? --page : currentPages.length - 1;
                } else if (i.customId === 'sell_rightPaginationButton') {
                    page = page + 1 < currentPages.length ? ++page : 0;
                } else if (i.customId === 'sell_sellButton') {
                    // Handle sell ONE item
                    const currentPage = currentPages[page];
                    const success = await this.processSell(interaction, currentPage.item, currentPage.sellPrice, 1);
                    if (success) {
                        // Update the embed to reflect the sale (decrement quantity by 1)
                        const newQuantity = currentPage.item.quantity - 1;
                        currentPage.item.quantity = newQuantity;
                        const newTotalPrice = currentPage.sellPrice * newQuantity;
                        const updatedEmbed = this.updateEmbedAfterSell(currentPage.embed, newQuantity, newTotalPrice, i.client);
                        const updatedButtons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, newQuantity > 0);
                        await i.editReply({ 
                            embeds: [updatedEmbed], 
                            components: [filterDropdown, updatedButtons]
                        });
                        return;
                    }
                }
                const currentPage = currentPages[page];
                const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canSell);
                await i.editReply({ 
                    embeds: [currentPage.embed], 
                    components: [filterDropdown, buttons]
                });
            }
        });

        // Modal submit handler - create a named function so we can remove it later
        const modalHandler = async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit() || modalInteraction.customId !== 'sell_quantityModal') return;
            if (modalInteraction.user.id !== interaction.user.id) return;
            const currentPage = currentPages[page];
            const maxQty = currentPage.item.quantity;
            const qtyStr = modalInteraction.fields.getTextInputValue('sell_quantityInput');
            let qty = parseInt(qtyStr, 10);
            if (isNaN(qty) || qty < 1 || qty > maxQty) {
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction.reply({ content: `Please enter a valid quantity between 1 and ${maxQty}.`, flags: MessageFlags.Ephemeral });
                }
                return;
            }
            // Process the sale
            const success = await this.processSell(modalInteraction, currentPage.item, currentPage.sellPrice, qty);
            if (success) {
                // Update the embed and buttons
                const newQuantity = currentPage.item.quantity - qty;
                currentPage.item.quantity = newQuantity;
                const newTotalPrice = currentPage.sellPrice * newQuantity;
                const updatedEmbed = this.updateEmbedAfterSell(currentPage.embed, newQuantity, newTotalPrice, modalInteraction.client);
                const updatedButtons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, newQuantity > 0);
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction.update({
                        embeds: [updatedEmbed],
                        components: [filterDropdown, updatedButtons]
                    });
                } else {
                    await modalInteraction.editReply({
                        embeds: [updatedEmbed],
                        components: [filterDropdown, updatedButtons]
                    });
                }
                // Send confirmation embed (as a followUp only if not already replied)
                const displayName = modalInteraction.client.inventory.getDisplayName(currentPage.item, currentPage.item.variant);
                const displayEmoji = modalInteraction.client.inventory.getDisplayEmoji(currentPage.item, currentPage.item.variant);
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('💰 Item Sold')
                    .setDescription(`Successfully sold **${qty}x ${displayEmoji} ${displayName}**`)
                    .addFields(
                        { name: '💵 Sale Price', value: modalInteraction.client.economy.formatCurrency(currentPage.sellPrice * qty), inline: true },
                        { name: '📦 Remaining', value: `${newQuantity}x`, inline: true }
                    )
                    .setFooter({ text: `Sold by ${modalInteraction.user.tag}` })
                    .setTimestamp();
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    // If already replied, send as a new ephemeral message
                    await modalInteraction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }
            } else {
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction.reply({ content: 'There was an error processing your sale.', flags: MessageFlags.Ephemeral });
                }
            }
        };

        // Add the modal handler
        interaction.client.on('interactionCreate', modalHandler);

        collector.on('end', () => {
            const currentPage = currentPages[page];
            const disabledButtons = this.getDisabledButtons(currentPage.pageNumber, currentPage.totalPages);
            interaction.editReply({ components: [filterDropdown, disabledButtons] });
            
            // Remove the modal handler to prevent memory leaks
            interaction.client.removeListener('interactionCreate', modalHandler);
        });
    },

    getButtons(pageNumber, totalPages, canSell, showSellQuantity = true) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sell_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === 1),
                new ButtonBuilder()
                    .setCustomId('sell_sellButton')
                    .setLabel('💰 Sell')
                    .setStyle(canSell ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setDisabled(!canSell),
                new ButtonBuilder()
                    .setCustomId('sell_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === totalPages)
            );
        if (showSellQuantity) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('sell_quantityButton')
                    .setLabel('🔢 Sell Quantity')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!canSell)
            );
        }
        return row;
    },

    getFilterDropdown() {
        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('sell_filterDropdown')
                    .setPlaceholder('🔍 Filter by item type...')
                    .addOptions([
                        {
                            label: 'All Items',
                            description: 'Show all items in your inventory',
                            value: 'all',
                            emoji: '📦'
                        },
                        {
                            label: 'Farming Items',
                            description: 'Seeds, watering cans, and fertilisers',
                            value: 'farming',
                            emoji: '🌾'
                        },
                        {
                            label: 'Seeds',
                            description: 'Show only seeds',
                            value: 'seed',
                            emoji: '🌱'
                        },
                        {
                            label: 'Watering Cans',
                            description: 'Show only watering cans',
                            value: 'watering_can',
                            emoji: '🚿'
                        },
                        {
                            label: 'Fertilisers',
                            description: 'Show only fertilisers',
                            value: 'fertiliser',
                            emoji: '💩'
                        },
                        {
                            label: 'Crops',
                            description: 'Show only harvested crops',
                            value: 'crop',
                            emoji: '🌽'
                        },
                        {
                            label: 'Fishing Items',
                            description: 'Fishing rods and fish',
                            value: 'fishing',
                            emoji: '🎣'
                        },
                        {
                            label: 'Fish',
                            description: 'Show only fish items',
                            value: 'fish',
                            emoji: '🐟'
                        },
                        {
                            label: 'Fishing Rods',
                            description: 'Show only fishing rods',
                            value: 'fishing_rod',
                            emoji: '🎣'
                        },
                        {
                            label: 'Consumables',
                            description: 'Show only consumable items',
                            value: 'consumable',
                            emoji: '⚡'
                        },
                        {
                            label: 'Mystery Boxes',
                            description: 'Show only mystery boxes',
                            value: 'mystery',
                            emoji: '🎁'
                        }
                    ])
            );
    },

    getDisabledButtons(pageNumber, totalPages) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sell_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('sell_sellButton')
                    .setLabel('💰 Sell')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('sell_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
    },

    updateEmbedAfterSell(embed, newQuantity, newTotalPrice, client) {
        const newEmbed = EmbedBuilder.from(embed);
        const fields = newEmbed.data.fields;
        
        // Update quantity and total value fields
        for (let i = 0; i < fields.length; i++) {
            if (fields[i].name === '📦 Quantity') {
                fields[i].value = `${newQuantity}x`;
            } else if (fields[i].name === '💵 Total Value') {
                fields[i].value = client.economy.formatCurrency(newTotalPrice);
            } else if (fields[i].name === '🛒 Status') {
                fields[i].value = newQuantity > 0 ? '✅ Can sell' : '❌ Cannot sell';
            }
        }
        
        return newEmbed;
    },

    async processSell(interaction, item, sellPrice, quantity = 1) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const isModal = interaction.isModalSubmit && interaction.isModalSubmit();

        try {
            console.log(`[sell] User ${userId} attempting to sell item ${item.id}`);
            // Check if user has the item
            const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, item.id);
            if (currentQuantity < quantity) {
                if (isModal) {
                    await interaction.reply({
                        content: 'You don\'t have enough of this item to sell!',
                        flags: MessageFlags.Ephemeral
                    });
                } else if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: 'You don\'t have enough of this item to sell!',
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({
                        content: 'You don\'t have enough of this item to sell!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return false;
            }
            // Sell the item
            const result = interaction.client.inventory.sellItem(userId, guildId, item.id, quantity);
            if (!result.success) {
                if (isModal) {
                    await interaction.reply({
                        content: `❌ ${result.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                } else if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: `❌ ${result.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({
                        content: `❌ ${result.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                return false;
            }
            // Add coins to user's balance
            const newBalance = interaction.client.economy.updateBalance(userId, guildId, result.sellPrice, 'balance');
            interaction.client.economy.logTransaction(userId, guildId, 'item_sale', result.sellPrice, `Sold ${quantity}x ${result.item.name}`);
            // Create success embed
            const displayName = interaction.client.inventory.getDisplayName(item, item.variant);
            const displayEmoji = interaction.client.inventory.getDisplayEmoji(item, item.variant);
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💰 Item Sold')
                .setDescription(`Successfully sold **${quantity}x ${displayEmoji} ${displayName}**`)
                .addFields(
                    { name: '💵 Sale Price', value: interaction.client.economy.formatCurrency(result.sellPrice), inline: true },
                    { name: '💰 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true },
                    { name: '📦 Original Price', value: interaction.client.economy.formatCurrency(result.item.price), inline: true },
                    { name: '📊 Sell Rate', value: `${Math.round(result.sellPercentage * 100)}% (${result.item.rarity.charAt(0).toUpperCase() + result.item.rarity.slice(1)})`, inline: true }
                )
                .setFooter({ text: `Sold by ${interaction.user.tag}` })
                .setTimestamp();
            if (isModal) {
                // Success handled by modalInteraction.update in the modal handler
                return true;
            } else if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            return true;
        } catch (error) {
            console.error('Error processing sell:', error);
            if (isModal) {
                await interaction.reply({
                    content: 'There was an error processing the sale!',
                    flags: MessageFlags.Ephemeral
                });
            } else if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error processing the sale!',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: 'There was an error processing the sale!',
                    flags: MessageFlags.Ephemeral
                });
            }
            return false;
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Get user's inventory items
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            if (!Array.isArray(inventory) || inventory.length === 0) {
                await interaction.respond([]);
                return;
            }
            const choices = inventory.map(item => {
                const sellPercentage = interaction.client.inventory.getSellPricePercentage(item.rarity, item.type);
                const sellPrice = Math.floor(item.price * sellPercentage);
                const displayName = interaction.client.inventory.getDisplayName(item, item.variant);
                return {
                    name: `${displayName} (${item.quantity}x) - ${interaction.client.economy.formatCurrency(sellPrice)} (${Math.round(sellPercentage * 100)}%)`,
                    value: item.id
                };
            });
            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
                choice.value.toLowerCase().includes(focusedValue.toLowerCase())
            ).slice(0, 25);
            await interaction.respond(filtered);
        } catch (error) {
            console.error('Error in /sell autocomplete:', error);
            try {
                await interaction.respond([]);
            } catch (e) {
                console.error('Failed to respond to autocomplete interaction:', e);
            }
        }
    }
}; 