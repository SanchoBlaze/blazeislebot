const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the economy shop'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            const user = interaction.client.economy.getUser(userId, guildId);
            // Use SQL to exclude fish and crops from shop for better performance
            const allItems = interaction.client.inventory.getShopItemsExcludingTypes(guildId, ['fish', 'crop']);
            
            if (allItems.length === 0) {
                return interaction.reply({ 
                    content: 'No items available in the shop! Use `/economy-admin populate-defaults` to add default items.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Store all items for filtering
            const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
            const originalItems = allItems.slice().sort((a, b) => {
                const aRank = rarityOrder[a.rarity] || 99;
                const bRank = rarityOrder[b.rarity] || 99;
                if (aRank !== bRank) return aRank - bRank;
                return a.name.localeCompare(b.name);
            });
            
            // Create pages with one item per page
            const pages = this.createPages(originalItems, user, interaction.client);
            
            if (pages.length === 0) {
                return interaction.reply({ 
                    content: 'No items available in the shop! Use `/economy-admin populate-defaults` to add default items.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Use custom shop paginator
            await this.shopPaginator(interaction, pages, originalItems, user);
            
        } catch (error) {
            console.error('Error in shop command:', error);
            await interaction.reply({ 
                content: 'There was an error loading the shop!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    createPages(items, user, client) {
        const pages = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const pageNumber = i + 1;
            const totalPages = items.length;
            
            const canAfford = user.balance >= item.price;
            const emoji = client.inventory.getItemEmoji(item);
            const rarityName = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
            const emojiUrl = client.inventory.getEmojiUrl(emoji, client);

            const embed = new EmbedBuilder()
                .setColor(client.inventory.getRarityColour(item.rarity))
                .setTitle(`🏪 ${item.name}`)
                .setDescription(item.description)
                .setThumbnail(emojiUrl)
                .addFields(
                    { name: '💰 Price', value: client.economy.formatCurrency(item.price), inline: true },
                    { name: '⭐ Rarity', value: rarityName, inline: true },
                    { name: '📦 Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                    { name: '💵 Your Balance', value: client.economy.formatCurrency(user.balance), inline: true },
                    { name: '🏦 Bank Balance', value: client.economy.formatCurrency(user.bank), inline: true },
                    { name: '💎 Net Worth', value: client.economy.formatCurrency(user.balance + user.bank), inline: true },
                    { name: '📄 Page', value: `${pageNumber}/${totalPages}`, inline: true },
                    { name: '🛒 Status', value: canAfford ? '✅ Can afford' : '❌ Cannot afford', inline: true }
                )
                .setFooter({ text: 'Use the arrow buttons to navigate, buy button to purchase' })
                .setTimestamp();

            // Store item data for purchase handling
            pages.push({ 
                embed, 
                item,
                canAfford,
                pageNumber,
                totalPages
            });
        }
        
        return pages;
    },

    async shopPaginator(interaction, pages, originalItems, user) {
        if (pages.length === 1) {
            const page = pages[0];
            const buttons = this.getButtons(page.pageNumber, page.totalPages, page.canAfford);
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
        const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canAfford);
        
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
            if (i.isStringSelectMenu() && i.customId === 'shop_filterDropdown') {
                await i.deferUpdate();
                const filterType = i.values[0];
                let filteredItems = originalItems;
                if (filterType !== 'all') {
                    if (filterType === 'seed') {
                        filteredItems = originalItems.filter(item => item.type === 'seed');
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
                // Update user balance in case it changed
                const updatedUser = interaction.client.economy.getUser(interaction.user.id, interaction.guild.id);
                currentPages = this.createPages(filteredItems, updatedUser, interaction.client);
                page = 0;
                const newCurrentPage = currentPages[page];
                const newButtons = this.getButtons(newCurrentPage.pageNumber, newCurrentPage.totalPages, newCurrentPage.canAfford);
                await i.editReply({ 
                    embeds: [newCurrentPage.embed], 
                    components: [filterDropdown, newButtons]
                });
                return;
            }
            // Handle button interactions
            if (i.isButton()) {
                await i.deferUpdate();
                if (i.customId === 'shop_leftPaginationButton') {
                    page = page > 0 ? --page : currentPages.length - 1;
                } else if (i.customId === 'shop_rightPaginationButton') {
                    page = page + 1 < currentPages.length ? ++page : 0;
                } else if (i.customId === 'shop_buyButton') {
                    // Handle purchase
                    const currentPage = currentPages[page];
                    const success = await this.processPurchase(interaction, currentPage.item);
                    if (success) {
                        // Update user balance for the embed
                        const updatedUser = interaction.client.economy.getUser(interaction.user.id, interaction.guild.id);
                        const updatedEmbed = this.updateEmbedBalance(currentPage.embed, updatedUser, interaction.client);
                        // Get the user's new quantity for this item
                        const newQuantity = interaction.client.inventory.getItemCount(interaction.user.id, interaction.guild.id, currentPage.item.id);
                        const atMax = newQuantity >= currentPage.item.max_quantity;
                        const updatedButtons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, !atMax && currentPage.canAfford);
                        await i.editReply({ 
                            embeds: [updatedEmbed], 
                            components: [filterDropdown, updatedButtons]
                        });
                        return;
                    }
                }
                const currentPage = currentPages[page];
                const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canAfford);
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

    getButtons(pageNumber, totalPages, canAfford) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === 1),
                new ButtonBuilder()
                    .setCustomId('shop_buyButton')
                    .setLabel('🛒 Buy')
                    .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setDisabled(!canAfford),
                new ButtonBuilder()
                    .setCustomId('shop_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === totalPages)
            );
    },

    getFilterDropdown() {
        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('shop_filterDropdown')
                    .setPlaceholder('🔍 Filter by item type...')
                    .addOptions([
                        {
                            label: 'All Items',
                            description: 'Show all available items',
                            value: 'all',
                            emoji: '📦'
                        },
                        {
                            label: 'Seeds',
                            description: 'Show only seeds',
                            value: 'seed',
                            emoji: '🌱'
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
                    .setCustomId('shop_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('shop_buyButton')
                    .setLabel('🛒 Buy')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('shop_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
    },

    updateEmbedBalance(embed, user, client) {
        const newEmbed = EmbedBuilder.from(embed);
        const fields = newEmbed.data.fields;
        
        // Update balance fields
        for (let i = 0; i < fields.length; i++) {
            if (fields[i].name === '💵 Your Balance') {
                fields[i].value = client.economy.formatCurrency(user.balance);
            } else if (fields[i].name === '🏦 Bank Balance') {
                fields[i].value = client.economy.formatCurrency(user.bank);
            } else if (fields[i].name === '💎 Net Worth') {
                fields[i].value = client.economy.formatCurrency(user.balance + user.bank);
            }
        }
        
        return newEmbed;
    },

    async processPurchase(interaction, item) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            console.log(`[shop purchase] User ${userId} attempting to buy item ${item.id}`);
            
            // Prevent buying fish items
            if (item.type === 'fish') {
                await interaction.followUp({
                    content: 'Fish can only be obtained by fishing, not by purchasing from the shop!',
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }

            const user = interaction.client.economy.getUser(userId, guildId);
            
            if (user.balance < item.price) {
                await interaction.followUp({ 
                    content: `You don't have enough coins! You need ${interaction.client.economy.formatCurrency(item.price)}.`, 
                    flags: MessageFlags.Ephemeral 
                });
                return false;
            }

            // Check if user already has the item and if there's a quantity limit
            const currentQuantity = interaction.client.inventory.getItemCount(userId, guildId, item.id);
            if (currentQuantity >= item.max_quantity) {
                await interaction.followUp({ 
                    content: `You already have the maximum quantity of ${item.name}! (${item.max_quantity})`, 
                    flags: MessageFlags.Ephemeral 
                });
                return false;
            }

            // Process the purchase
            const success = await interaction.client.inventory.addItem(userId, guildId, item.id, 1, interaction, interaction.client);
            
            if (success) {
                console.log(`[shop purchase] User ${userId} successfully bought item ${item.id}`);
                // Deduct coins and log transaction
                await interaction.client.economy.updateBalance(userId, guildId, -item.price, 'balance');
                interaction.client.economy.logTransaction(userId, guildId, 'shop_purchase', -item.price, `Purchased ${item.name}`);
                
                const emoji = interaction.client.inventory.getItemEmoji(item);
                const embed = new EmbedBuilder()
                    .setColor(interaction.client.inventory.getRarityColour(item.rarity))
                    .setTitle('🛒 Purchase Successful!')
                    .setDescription(`You purchased **${emoji} ${item.name}** for ${interaction.client.economy.formatCurrency(item.price)}`)
                    .addFields(
                        { name: '📦 Item Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                        { name: '⭐ Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true },
                        { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(user.balance - item.price), inline: true }
                    )
                    .setFooter({ text: 'Use /inventory to view your items, /use to use them!' })
                    .setTimestamp();

                await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return true;
            } else {
                await interaction.followUp({ 
                    content: 'There was an error processing your purchase!', 
                    flags: MessageFlags.Ephemeral 
                });
                return false;
            }
        } catch (error) {
            console.error('Error processing shop purchase:', error);
            await interaction.followUp({ 
                content: 'There was an error processing your purchase!', 
                flags: MessageFlags.Ephemeral 
            });
            return false;
        }
    },

    // Handle select menu interactions for shop purchases (legacy support)
    async handleButtonInteraction(interaction) {
        if (!interaction.isStringSelectMenu()) return false;
        
        const customId = interaction.customId;
        
        // Handle item selection (legacy dropdown)
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

                // Prevent buying fish items
                if (item.type === 'fish') {
                    await interaction.reply({
                        content: 'Fish can only be obtained by fishing, not by purchasing from the shop!',
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
                const success = await interaction.client.inventory.addItem(userId, guildId, selectedItemId, 1, interaction, interaction.client);
                
                if (success) {
                    console.log(`[shop purchase] User ${userId} successfully bought item ${selectedItemId}`);
                    // Deduct coins and log transaction
                    await interaction.client.economy.updateBalance(userId, guildId, -item.price, 'balance');
                    interaction.client.economy.logTransaction(userId, guildId, 'shop_purchase', -item.price, `Purchased ${item.name}`);
                    
                    const emoji = interaction.client.inventory.getItemEmoji(item);
                    const embed = new EmbedBuilder()
                        .setColor(interaction.client.inventory.getRarityColour(item.rarity))
                        .setTitle('🛒 Purchase Successful!')
                        .setDescription(`You purchased **${emoji} ${item.name}** for ${interaction.client.economy.formatCurrency(item.price)}`)
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