const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell items from your inventory back to the shop')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item to sell')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('Quantity to sell (default: 1)')
                .setRequired(false)
                .setMinValue(1)),

    async execute(interaction) {
        const itemId = interaction.options.getString('item');
        const quantity = interaction.options.getInteger('quantity') || 1;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Check if user has any items first
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            if (!inventory || inventory.length === 0) {
                return interaction.reply({
                    content: '❌ You don\'t have any items to sell! Visit the shop to buy some items first.',
                    ephemeral: true
                });
            }

            // Sell the item
            const result = interaction.client.inventory.sellItem(userId, guildId, itemId, quantity);
            
            if (!result.success) {
                return interaction.reply({
                    content: `❌ ${result.message}`,
                    ephemeral: true
                });
            }

            // Add coins to user's balance
            const newBalance = interaction.client.economy.updateBalance(userId, guildId, result.sellPrice, 'balance');
            interaction.client.economy.logTransaction(userId, guildId, 'item_sale', result.sellPrice, `Sold ${quantity}x ${result.item.name}`);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💰 Item Sold')
                .setDescription(`Successfully sold **${quantity}x ${result.item.name}**`)
                .addFields(
                    { name: '💵 Sale Price', value: interaction.client.economy.formatCurrency(result.sellPrice), inline: true },
                    { name: '💰 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true },
                    { name: '📦 Original Price', value: interaction.client.economy.formatCurrency(result.item.price), inline: true },
                    { name: '📊 Sell Rate', value: `${Math.round(result.sellPercentage * 100)}% (${result.item.rarity.charAt(0).toUpperCase() + result.item.rarity.slice(1)})`, inline: true }
                )
                .setFooter({ text: `Sold by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in sell command:', error);
            await interaction.reply({
                content: 'There was an error processing the sale!',
                ephemeral: true
            });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Get user's inventory items
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            
            // If inventory is empty, return empty array
            if (!inventory || inventory.length === 0) {
                return await interaction.respond([]);
            }
            
            const choices = inventory.map(item => {
                const sellPercentage = interaction.client.inventory.getSellPricePercentage(item.rarity);
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
            console.error('Error in sell autocomplete:', error);
            await interaction.respond([]);
        }
    }
}; 