const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, StringSelectMenuBuilder } = require('discord.js');

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

            // Deduplicate items by id and sum quantities
            const uniqueItems = {};
            for (const item of inventory) {
                if (!uniqueItems[item.id]) {
                    uniqueItems[item.id] = { ...item };
                } else {
                    uniqueItems[item.id].quantity += item.quantity;
                }
            }

            const allItems = Object.values(uniqueItems);
            
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
            const emoji = client.inventory.getItemEmoji(item);
            const rarityName = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
            const emojiUrl = client.inventory.getEmojiUrl(emoji, client);

            const embed = new EmbedBuilder()
                .setColor(client.inventory.getRarityColour(item.rarity))
                .setTitle(`💰 ${item.name}`)
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
                    filteredItems = originalItems.filter(item => item.type === filterType);
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
                await i.deferUpdate();
                if (i.customId === 'sell_leftPaginationButton') {
                    page = page > 0 ? --page : currentPages.length - 1;
                } else if (i.customId === 'sell_rightPaginationButton') {
                    page = page + 1 < currentPages.length ? ++page : 0;
                } else if (i.customId === 'sell_sellButton') {
                    // Handle sell
                    const currentPage = currentPages[page];
                    const success = await this.processSell(interaction, currentPage.item, currentPage.totalSellPrice);
                    if (success) {
                        // Update the embed to reflect the sale
                        const updatedEmbed = this.updateEmbedAfterSell(currentPage.embed, 0, 0, i.client); // 0 quantity after sale
                        const updatedButtons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, false); // Disable sell button after sale
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

        collector.on('end', () => {
            const currentPage = currentPages[page];
            const disabledButtons = this.getDisabledButtons(currentPage.pageNumber, currentPage.totalPages);
            interaction.editReply({ components: [filterDropdown, disabledButtons] });
        });
    },

    getButtons(pageNumber, totalPages, canSell) {
        return new ActionRowBuilder()
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

    async processSell(interaction, item, totalSellPrice) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            console.log(`[sell] User ${userId} attempting to sell item ${item.id}`);
            
            // Check if user has the item
            const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, item.id);
            if (currentQuantity <= 0) {
                await interaction.followUp({
                    content: 'You don\'t have any of this item to sell!',
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }

            // Sell the item
            const result = interaction.client.inventory.sellItem(userId, guildId, item.id, currentQuantity);
            
            if (!result.success) {
                await interaction.followUp({
                    content: `❌ ${result.message}`,
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }

            // Add coins to user's balance
            const newBalance = interaction.client.economy.updateBalance(userId, guildId, result.sellPrice, 'balance');
            interaction.client.economy.logTransaction(userId, guildId, 'item_sale', result.sellPrice, `Sold ${currentQuantity}x ${result.item.name}`);

            // Create success embed
            const emoji = interaction.client.inventory.getItemEmoji(item);
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💰 Item Sold')
                .setDescription(`Successfully sold **${currentQuantity}x ${emoji} ${result.item.name}**`)
                .addFields(
                    { name: '💵 Sale Price', value: interaction.client.economy.formatCurrency(result.sellPrice), inline: true },
                    { name: '💰 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true },
                    { name: '📦 Original Price', value: interaction.client.economy.formatCurrency(result.item.price), inline: true },
                    { name: '📊 Sell Rate', value: `${Math.round(result.sellPercentage * 100)}% (${result.item.rarity.charAt(0).toUpperCase() + result.item.rarity.slice(1)})`, inline: true }
                )
                .setFooter({ text: `Sold by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return true;

        } catch (error) {
            console.error('Error processing sell:', error);
            await interaction.followUp({ 
                content: 'There was an error processing the sale!', 
                flags: MessageFlags.Ephemeral 
            });
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
                return {
                    name: `${item.name} (${item.quantity}x) - ${interaction.client.economy.formatCurrency(sellPrice)} (${Math.round(sellPercentage * 100)}%)`,
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