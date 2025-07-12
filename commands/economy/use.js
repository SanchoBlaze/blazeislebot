const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Get user's inventory and filter for usable items
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId)
                .filter(item => item.effect_type && item.quantity > 0 && (!item.expires_at || new Date(item.expires_at) > new Date()));

            if (!inventory || inventory.length === 0) {
                return interaction.reply({
                    content: '❌ You don\'t have any usable items! Visit the shop to buy some items first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Deduplicate items by id and variant, sum quantities
            const uniqueItems = {};
            for (const item of inventory) {
                const key = item.variant ? `${item.id}_${item.variant}` : item.id;
                if (!uniqueItems[key]) {
                    uniqueItems[key] = { ...item };
                } else {
                    uniqueItems[key].quantity += item.quantity;
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
                    content: '❌ You don\'t have any usable items! Visit the shop to buy some items first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await this.usePaginator(interaction, pages, allItems);
        } catch (error) {
            console.error('Error in use command:', error);
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
            const displayName = client.inventory.getDisplayName(item, item.variant);
            const displayEmoji = client.inventory.getDisplayEmoji(item, item.variant);
            const rarityName = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
            const emojiUrl = client.inventory.getEmojiUrl(displayEmoji, client);

            const embed = new EmbedBuilder()
                .setColor(client.inventory.getRarityColour(item.rarity))
                .setTitle(`🎯 ${displayName}`)
                .setDescription(item.description)
                .setThumbnail(emojiUrl)
                .addFields(
                    { name: '📦 Quantity', value: `${item.quantity}x`, inline: true },
                    { name: '⭐ Rarity', value: rarityName, inline: true },
                    { name: '📦 Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                    { name: '📄 Page', value: `${pageNumber}/${totalPages}`, inline: true },
                    { name: '🛒 Status', value: item.quantity > 0 ? '✅ Can use' : '❌ Cannot use', inline: true }
                )
                .setFooter({ text: 'Use the arrow buttons to navigate, use button to use items' })
                .setTimestamp();

            pages.push({
                embed,
                item,
                canUse: item.quantity > 0,
                pageNumber,
                totalPages
            });
        }
        return pages;
    },

    getButtons(pageNumber, totalPages, canUse) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('use_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === 1),
                new ButtonBuilder()
                    .setCustomId('use_useButton')
                    .setLabel('🎯 Use')
                    .setStyle(canUse ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setDisabled(!canUse),
                new ButtonBuilder()
                    .setCustomId('use_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNumber === totalPages)
            );
    },

    getFilterDropdown() {
        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('use_filterDropdown')
                    .setPlaceholder('🔍 Filter by item type...')
                    .addOptions([
                        {
                            label: 'All Usable Items',
                            description: 'Show all usable items in your inventory',
                            value: 'all',
                            emoji: '📦'
                        },
                        {
                            label: 'Consumables',
                            description: 'Show only consumable items',
                            value: 'consumable',
                            emoji: '⚡'
                        },
                        {
                            label: 'Boosts',
                            description: 'Show only boost items',
                            value: 'boost',
                            emoji: '🚀'
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
                    .setCustomId('use_leftPaginationButton')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('use_useButton')
                    .setLabel('🎯 Use')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('use_rightPaginationButton')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
    },

    async usePaginator(interaction, pages, originalItems) {
        if (pages.length === 1) {
            const page = pages[0];
            const buttons = this.getButtons(page.pageNumber, page.totalPages, page.canUse);
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
        const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canUse);

        await interaction.reply({
            embeds: [currentPage.embed],
            components: [filterDropdown, buttons],
            flags: MessageFlags.Ephemeral
        });
    },

    updateEmbedAfterUse(embed, newQuantity, client) {
        const newEmbed = EmbedBuilder.from(embed);
        const fields = newEmbed.data.fields;
        
        // Update quantity and status fields
        for (let i = 0; i < fields.length; i++) {
            if (fields[i].name === '📦 Quantity') {
                fields[i].value = `${newQuantity}x`;
            } else if (fields[i].name === '🛒 Status') {
                fields[i].value = newQuantity > 0 ? '✅ Can use' : '❌ Cannot use';
            }
        }
        
        return newEmbed;
    },

    async handleButtonInteraction(interaction) {
        if (!(interaction.isButton() || interaction.isStringSelectMenu())) return false;
        if (!interaction.customId.startsWith('use_')) return false;
        // Re-fetch inventory and pages
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const inventory = interaction.client.inventory.getUserInventory(userId, guildId)
            .filter(item => item.effect_type && item.quantity > 0 && (!item.expires_at || new Date(item.expires_at) > new Date()));
        const uniqueItems = {};
        for (const item of inventory) {
            if (!uniqueItems[item.id]) {
                uniqueItems[item.id] = { ...item };
            } else {
                uniqueItems[item.id].quantity += item.quantity;
            }
        }
        const allItems = Object.values(uniqueItems);
        allItems.sort((a, b) => {
            const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
            const aRank = rarityOrder[a.rarity] || 99;
            const bRank = rarityOrder[b.rarity] || 99;
            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
        });
        let currentPages = this.createPages(allItems, interaction.client);
        let page = 0;
        // Try to get current page from embed footer
        if (interaction.message.embeds && interaction.message.embeds[0]) {
            const pageField = interaction.message.embeds[0].fields?.find(f => f.name === '📄 Page');
            if (pageField) {
                const [current, total] = pageField.value.split('/').map(Number);
                if (!isNaN(current) && current > 0 && current <= currentPages.length) {
                    page = current - 1;
                }
            }
        }
        const filterDropdown = this.getFilterDropdown();
        // Handle dropdown filter
        if (interaction.isStringSelectMenu() && interaction.customId === 'use_filterDropdown') {
            await interaction.deferUpdate();
            const filterType = interaction.values[0];
            let filteredItems = allItems;
            if (filterType !== 'all') {
                filteredItems = allItems.filter(item => item.type === filterType);
            }
            if (filteredItems.length === 0) {
                const noItemsEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🔍 No Items Found')
                    .setDescription(`No usable items found for the selected filter: **${filterType.charAt(0).toUpperCase() + filterType.slice(1)}**`)
                    .setFooter({ text: 'Try selecting a different filter' })
                    .setTimestamp();
                await interaction.editReply({
                    embeds: [noItemsEmbed],
                    components: [filterDropdown, this.getDisabledButtons(1, 1)]
                });
                return true;
            }
            currentPages = this.createPages(filteredItems, interaction.client);
            page = 0;
            const newCurrentPage = currentPages[page];
            const newButtons = this.getButtons(newCurrentPage.pageNumber, newCurrentPage.totalPages, newCurrentPage.canUse);
            await interaction.editReply({
                embeds: [newCurrentPage.embed],
                components: [filterDropdown, newButtons]
            });
            return true;
        }
        // Handle button interactions
        if (interaction.isButton()) {
            if (interaction.customId === 'use_leftPaginationButton') {
                await interaction.deferUpdate();
                page = page > 0 ? --page : currentPages.length - 1;
            } else if (interaction.customId === 'use_rightPaginationButton') {
                await interaction.deferUpdate();
                page = page + 1 < currentPages.length ? ++page : 0;
            } else if (interaction.customId === 'use_useButton') {
                await interaction.deferUpdate();
                const currentPage = currentPages[page];
                try {
                    const result = await interaction.client.inventory.useItem(userId, guildId, currentPage.item.id);
                    const newQuantity = currentPage.item.quantity - 1;
                    currentPage.item.quantity = newQuantity;
                    // Determine which emoji to use as thumbnail
                    let thumbEmoji, thumbEmojiUrl;
                    if (result.effect && (result.effect.type === 'item' || result.effect.type === 'item_received') && result.effect.item) {
                        thumbEmoji = interaction.client.inventory.getItemEmoji(result.effect.item);
                        thumbEmojiUrl = interaction.client.inventory.getEmojiUrl(thumbEmoji, interaction.client);
                    } else {
                        thumbEmoji = interaction.client.inventory.getItemEmoji(currentPage.item);
                        thumbEmojiUrl = interaction.client.inventory.getEmojiUrl(thumbEmoji, interaction.client);
                    }
                    const successEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🎯 Item Used Successfully!')
                        .setDescription(result.message)
                        .setThumbnail(thumbEmojiUrl)
                        .setTimestamp();
                    const updatedEmbed = this.updateEmbedAfterUse(currentPage.embed, newQuantity, interaction.client);
                    const updatedButtons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, newQuantity > 0);
                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: [filterDropdown, updatedButtons]
                    });
                    await interaction.followUp({
                        embeds: [successEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                } catch (error) {
                    await interaction.followUp({
                        content: error.message || 'There was an error using the item!',
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }
            }
            const currentPage = currentPages[page];
            const buttons = this.getButtons(currentPage.pageNumber, currentPage.totalPages, currentPage.canUse);
            await interaction.editReply({
                embeds: [currentPage.embed],
                components: [filterDropdown, buttons]
            });
            return true;
        }
        return false;
    }
}; 