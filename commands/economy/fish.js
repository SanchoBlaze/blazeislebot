const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing to catch fish! (30 minute cooldown)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const result = await interaction.client.economy.fish(userId, guildId);
            
            // Check if this is a mermaid event
            if (result.mermaid) {
                const mermaidMessages = [
                    "You feel a gentle tug on your line, but it's not a fish...",
                    "Something magical brushes against your fishing line...",
                    "The water sparkles with an otherworldly light...",
                    "You hear the faint sound of singing beneath the waves...",
                    "A mysterious presence approaches your fishing spot...",
                    "The water ripples with an enchanting energy...",
                    "You sense something extraordinary in the depths...",
                    "The waves seem to dance with an ancient rhythm...",
                    "A magical aura surrounds your fishing area...",
                    "The sea whispers secrets to your fishing rod..."
                ];
                
                const mermaidDialogues = [
                    "Oh! You caught me instead of a fish! How embarrassing! *giggles*",
                    "Hello there, land-dweller! I was just swimming by when I got tangled in your line!",
                    "Well, this is a surprise! I don't usually get caught by fishermen!",
                    "Oops! I was admiring your fishing technique and got too close!",
                    "Greetings from the depths! Your fishing skills are quite impressive!",
                    "I was just curious about what you were doing up here! Sorry for the confusion!",
                    "Oh my! I've never been 'caught' before! This is quite exciting!",
                    "Hello! I was following the fish you were trying to catch, but I got caught instead!",
                    "What a delightful encounter! I don't often meet surface-dwellers!",
                    "I was just exploring the shallows when your line found me! How serendipitous!"
                ];
                
                const randomMessage = mermaidMessages[Math.floor(Math.random() * mermaidMessages.length)];
                const randomDialogue = mermaidDialogues[Math.floor(Math.random() * mermaidDialogues.length)];

                // Calculate cooldown info
                const cooldownMultiplier = interaction.client.inventory.getFishingCooldown(userId, guildId);
                const baseCooldown = 30;
                const actualCooldown = Math.round(baseCooldown * cooldownMultiplier);

                // Mermaid image attachment
                const mermaidImage = new AttachmentBuilder('assets/fishing_mermaid_225.png', { name: 'fishing_mermaid_225.png' });

                const embed = new EmbedBuilder()
                    .setColor(0x00BFFF) // Light blue for mermaid theme
                    .setTitle('🧜‍♀️ A Mermaid Appears!')
                    .setDescription(`${randomMessage}`)
                    .addFields(
                        { 
                            name: '🧜‍♀️ The Mermaid Says', 
                            value: `*"${randomDialogue}"*\n\n*She smiles warmly and gracefully swims away, leaving you with a magical memory of this special encounter.*`, 
                            inline: false
                        }
                    )
                    .setThumbnail('attachment://fishing_mermaid_225.png')
                    .setFooter({ text: `You can fish again in ${actualCooldown} minutes!` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], files: [mermaidImage], flags: MessageFlags.Ephemeral });
                return;
            }
            
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

            // Check if user has a fishing rod and bait
            const bestRod = interaction.client.inventory.getBestFishingRod(userId, guildId);
            const hasFishingRod = bestRod !== null;
            const baitBoost = interaction.client.inventory.getBaitBoost(userId, guildId);
            const hasBait = baitBoost > 1;

            // Calculate cooldown info
            const cooldownMultiplier = interaction.client.inventory.getFishingCooldown(userId, guildId);
            const baseCooldown = 30;
            const actualCooldown = Math.round(baseCooldown * cooldownMultiplier);
            const cooldownReduction = Math.round((1 - cooldownMultiplier) * 100);

            // Get emoji URL for thumbnail
            const emojiUrl = interaction.client.inventory.getEmojiUrl(emoji, interaction.client);

            const embed = new EmbedBuilder()
                .setColor(rarityColor)
                .setTitle('🎣 Fishing Complete!')
                .setDescription(`${randomMessage}`)
                .addFields(
                    { 
                        name: 'You Caught', 
                        value: `${emoji} **${result.fish.name}**\n\n${result.fish.description}\n\n💰 **Sell Price:** ${interaction.client.economy.formatCurrency(result.fish.sellPrice)}`, 
                        inline: false
                    }
                )
                .setFooter({ text: `You can fish again in ${actualCooldown} minutes!` })
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
                    value: `${rodEmoji} **${bestRod.name}** (${cooldownReduction}% faster cooldown)`,
                    inline: false
                });
            }

            // Add bait info if user has active bait
            if (hasBait) {
                embed.addFields({
                    name: '🪱 Active Bait',
                    value: `🎣 **Fishing Bait** (${baitBoost}x rare fish boost)`,
                    inline: false
                });
            }

            // Add special message for rare catches
            if (result.fish.rarity === 'rare' || result.fish.rarity === 'epic' || result.fish.rarity === 'legendary' || result.fish.rarity === 'mythic') {
                const rarityEmoji = result.fish.rarity === 'mythic' ? '🌈' : '🎉';
                const rarityText = result.fish.rarity === 'mythic' ? 'Mythic Catch!' : 'Rare Catch!';
                embed.addFields({
                    name: `${rarityEmoji} ${rarityText}`,
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
        } catch (error) {
            if (error.message.includes('Fishing available in')) {
                // Calculate cooldown info for error message
                const cooldownMultiplier = interaction.client.inventory.getFishingCooldown(userId, guildId);
                const baseCooldown = 30;
                const actualCooldown = Math.round(baseCooldown * cooldownMultiplier);

                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Fishing Not Ready')
                    .setDescription(`You need to wait before fishing again!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Fishing available in ', ''), inline: true }
                    )
                    .setFooter({ text: `Fishing has a ${actualCooldown}-minute cooldown` })
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