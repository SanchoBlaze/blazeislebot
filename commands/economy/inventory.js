const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your or another user\'s inventory')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check inventory for (optional)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        try {
            const inventory = interaction.client.inventory.getUserInventory(targetUser.id, guildId);
            
            if (inventory.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle(`📦 ${targetUser.username}'s Inventory`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setDescription('This inventory is empty! Visit the shop to get some items.')
                    .setFooter({ text: 'Use /shop to buy items' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
            // Group deduplicated items by rarity
            const itemsByRarity = {};
            for (const item of Object.values(uniqueItems)) {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            }

            let description = '';
            const rarities = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
            
            for (const rarity of rarities) {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    const rarityEmoji = interaction.client.inventory.getRarityEmoji(rarity);
                    const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
                    description += `\n**${rarityEmoji} ${rarityName} Items:**\n`;
                    
                    for (const item of itemsByRarity[rarity]) {
                        const quantityText = item.quantity > 1 ? ` (x${item.quantity})` : '';
                        const sellPercentage = interaction.client.inventory.getSellPricePercentage(item.rarity, item.type);
                        const sellPrice = Math.floor(item.price * sellPercentage);
                        const displayName = interaction.client.inventory.getDisplayName(item, item.variant);
                        const displayEmoji = interaction.client.inventory.getDisplayEmoji(item, item.variant);
                        description += `• **${displayEmoji} ${displayName}**${quantityText}\n`;
                        description += `  └ ${item.description}\n`;
                        description += `  └ 💰 Buy: ${interaction.client.economy.formatCurrency(item.price)} | 💵 Sell: ${interaction.client.economy.formatCurrency(sellPrice)} (${Math.round(sellPercentage * 100)}%)\n\n`;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📦 ${targetUser.username}'s Inventory`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(description)
                .addFields(
                    { name: '📊 Total Items', value: inventory.length.toString(), inline: true },
                    { name: '🎯 Unique Items', value: new Set(inventory.map(i => i.id)).size.toString(), inline: true },
                    { name: '💎 Total Quantity', value: inventory.reduce((sum, item) => sum + item.quantity, 0).toString(), inline: true }
                )
                .setFooter({ text: 'Use /use <item> to use items, /shop to buy more' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Error in inventory command:', error);
            await interaction.reply({ content: 'There was an error fetching the inventory!', flags: MessageFlags.Ephemeral });
        }
    },
}; 