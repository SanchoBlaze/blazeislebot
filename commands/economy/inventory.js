const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

                return interaction.reply({ embeds: [embed] });
            }

            // Group items by rarity
            const itemsByRarity = {};
            for (const item of inventory) {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            }

            let description = '';
            const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
            
            for (const rarity of rarities) {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    const rarityEmoji = interaction.client.inventory.getRarityEmoji(rarity);
                    const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
                    description += `\n**${rarityEmoji} ${rarityName} Items:**\n`;
                    
                    for (const item of itemsByRarity[rarity]) {
                        const quantityText = item.quantity > 1 ? ` (x${item.quantity})` : '';
                        const expiryText = item.expires_at ? ` ⏰` : '';
                        description += `• **${item.name}**${quantityText}${expiryText}\n`;
                        description += `  └ ${item.description}\n`;
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

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in inventory command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching the inventory!', 
                ephemeral: true 
            });
        }
    },
}; 