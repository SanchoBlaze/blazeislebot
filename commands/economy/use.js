const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Name or ID of the item to use')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        const itemQuery = interaction.options.getString('item');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Get user's inventory to find the item
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            const item = inventory.find(i => 
                i.name.toLowerCase().includes(itemQuery.toLowerCase()) || 
                i.id.toLowerCase().includes(itemQuery.toLowerCase())
            );

            if (!item) {
                return interaction.reply({ 
                    content: `Item "${itemQuery}" not found in your inventory! Use \`/inventory\` to see your items.`, 
                    ephemeral: true 
                });
            }

            // Use the item
            const result = await interaction.client.inventory.useItem(userId, guildId, item.id);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎯 Item Used Successfully!')
                .setDescription(result.message)
                .addFields(
                    { name: '📦 Item', value: item.name, inline: true },
                    { name: '🏷️ Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                    { name: '⭐ Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true }
                )
                .setFooter({ text: 'Item effect activated!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            if (error.message === 'Item not in inventory') {
                await interaction.reply({ 
                    content: `You don't have that item in your inventory! Use \`/inventory\` to see your items.`, 
                    ephemeral: true 
                });
            } else if (error.message === 'Item has expired') {
                await interaction.reply({ 
                    content: `That item has expired and has been removed from your inventory.`, 
                    ephemeral: true 
                });
            } else if (error.message === 'Not enough items') {
                await interaction.reply({ 
                    content: `You don't have enough of that item to use it.`, 
                    ephemeral: true 
                });
            } else if (error.message.includes('You already have an active')) {
                await interaction.reply({ 
                    content: `${error.message} Use \`/effects\` to see your active effects and their remaining time.`, 
                    ephemeral: true 
                });
            } else {
                console.error('Error in use command:', error);
                await interaction.reply({ 
                    content: 'There was an error using the item!', 
                    ephemeral: true 
                });
            }
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            const choices = inventory.map(item => ({
                name: `${item.name} (x${item.quantity})`,
                value: item.name
            }));

            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedValue.toLowerCase())
            ).slice(0, 25);

            await interaction.respond(filtered);
        } catch (error) {
            console.error('Error in use autocomplete:', error);
            await interaction.respond([]);
        }
    },
}; 