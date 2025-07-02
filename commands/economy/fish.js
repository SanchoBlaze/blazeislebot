const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing to catch fish! (30 minute cooldown)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const result = await interaction.client.economy.fish(userId, guildId);
            
            const fishingMessages = [
                "You cast your line and wait patiently...",
                "The water ripples as you feel a tug on your line!",
                "You carefully reel in your catch...",
                "The fish puts up a good fight, but you prevail!",
                "A perfect cast leads to a great catch!",
                "You spot something shiny in the water and hook it!",
                "The fish practically jumps into your net!",
                "Your fishing skills are improving!",
                "What a beautiful day for fishing!",
                "The fish are biting today!"
            ];
            
            const randomMessage = fishingMessages[Math.floor(Math.random() * fishingMessages.length)];

            // Get rarity color and emoji
            const rarityColor = interaction.client.inventory.getRarityColour(result.fish.rarity);
            const emoji = interaction.client.inventory.getItemEmoji(result.fish);

            // Check if user has a fishing rod
            const bestRod = interaction.client.inventory.getBestFishingRod(userId, guildId);
            const hasFishingRod = bestRod !== null;

            // Get emoji URL for thumbnail
            const emojiUrl = interaction.client.inventory.getEmojiUrl(emoji, interaction.client);

            const embed = new EmbedBuilder()
                .setColor(rarityColor)
                .setTitle('🎣 Fishing Complete!')
                .setDescription(`${randomMessage}`)
                .addFields(
                    { 
                        name: 'You Caught', 
                        value: `${emoji} **${result.fish.name}**\n\n💰 **Sell Price:** ${interaction.client.economy.formatCurrency(result.fish.sellPrice)}`, 
                        inline: false
                    }
                )
                .setFooter({ text: 'You can fish again in 30 minutes!' })
                .setTimestamp();

            // Always set thumbnail to the caught fish's emoji if available
            if (emojiUrl) {
                embed.setThumbnail(emojiUrl);
            }

            // Add fishing rod info if user has one
            if (hasFishingRod) {
                const rodEmoji = interaction.client.inventory.getItemEmoji(bestRod);
                embed.addFields({
                    name: '🎣 Fishing Rod',
                    value: `${rodEmoji} **${bestRod.name}** (${bestRod.effect_value}x rare fish boost)`,
                    inline: false
                });
            }

            // Add special message for rare catches
            if (result.fish.rarity === 'rare' || result.fish.rarity === 'epic' || result.fish.rarity === 'legendary') {
                embed.addFields({
                    name: '🎉 Rare Catch!',
                    value: `Congratulations! You caught a ${result.fish.rarity} fish!`,
                    inline: false
                });
            }

            // Add tip at the bottom
            embed.addFields({
                name: '💡 Tip',
                value: 'Use `/sell` to sell your catch!',
                inline: false
            });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

            // Add the fish to user's inventory
            interaction.client.inventory.addItem(userId, guildId, result.fish.id, 1, interaction, interaction.client);
        } catch (error) {
            if (error.message.includes('Fishing available in')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Fishing Not Ready')
                    .setDescription(`You need to wait before fishing again!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Fishing available in ', ''), inline: true }
                    )
                    .setFooter({ text: 'Fishing has a 30-minute cooldown' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else if (error.message.includes('No fish available')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🎣 No Fish Available')
                    .setDescription('There are no fish available for fishing in this server.')
                    .addFields({
                        name: '💡 Solution',
                        value: 'Contact a server administrator to add fish items using `/economy-admin add-item`',
                        inline: false
                    })
                    .setFooter({ text: 'Fish items need to be added to the shop first' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                console.error('Error in fish command:', error);
                await interaction.reply({ content: 'There was an error while fishing!', flags: MessageFlags.Ephemeral });
            }
        }
    },
}; 