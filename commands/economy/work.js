const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const config = require(path.resolve(__dirname, '../../config/default.json'));
const emojiConfigs = require(path.resolve(__dirname, '../../config/emoji-configs.json'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn coins (10-50 coins, 1 hour cooldown)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Load default items
        const defaultItems = require(path.resolve(__dirname, '../../data/default-items.json'));
        // Filter to items with a valid emoji
        const itemsWithEmoji = defaultItems.filter(item => item.emoji && typeof item.emoji === 'string');

        // Determine which emoji set to use
        const emojiSet = config.Enviroment && config.Enviroment.live ? emojiConfigs['default'] : emojiConfigs['test_bot'];

        // Helper to get emoji for an item
        function getItemEmoji(item) {
            // Try emoji config first
            if (emojiSet[item.id]) return emojiSet[item.id];
            // Try variant keys if present
            if (item.variants && Array.isArray(item.variants)) {
                for (const variant of item.variants) {
                    const variantKey = `${item.id}_${variant.id}`;
                    if (emojiSet[variantKey]) return emojiSet[variantKey];
                }
            }
            // Fallback to item's own emoji
            return item.emoji;
        }

        // Multi-level mini-game settings
        const levels = [
            { time: 10000, multiplier: 1, gridSize: 3, oddCount: 1 },    // 10s, 3x3, 1 odd
            { time: 8000, multiplier: 2, gridSize: 4, oddCount: 2 },     // 8s, 4x4, 2 odds
            { time: 6000, multiplier: 4, gridSize: 4, oddCount: 3 },     // 6s, 4x4, 3 odds
            { time: 5000, multiplier: 8, gridSize: 5, oddCount: 4 },     // 5s, 5x5, 4 odds
            { time: 4000, multiplier: 16, gridSize: 5, oddCount: 5 }     // 4s, 5x5, 5 odds
        ];
        const maxBaseReward = 120; // Increase max possible coins for perfect run

        // Helper to pick multiple different items (by emoji) from the pool
        function pickMultipleDistinctItems(pool, count, usedEmojis = []) {
            const items = [];
            const emojis = [];
            
            for (let i = 0; i < count; i++) {
                let item;
                do {
                    item = pool[Math.floor(Math.random() * pool.length)];
                } while (emojis.includes(getItemEmoji(item)) || usedEmojis.includes(getItemEmoji(item)));
                
                items.push(item);
                emojis.push(getItemEmoji(item));
            }
            
            return items;
        }

        // First, check cooldown before showing the mini-game
        try {
            await interaction.client.economy.work(userId, guildId, { dryRun: true });
        } catch (error) {
            if (error.message.includes('Work available in')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Work Not Ready')
                    .setDescription(`You need to rest before working again!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Work available in ', ''), inline: true }
                    )
                    .setFooter({ text: 'Work has a 1-hour cooldown' })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            } else {
                console.error('Error in work command:', error);
                await interaction.reply({ content: 'There was an error processing your work!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        // Track used emojis to avoid repeats
        let usedEmojis = [];
        let currentLevel = 0;
        let totalMultiplier = 0;
        let lastSuccess = false;

        async function playLevel(levelIdx) {
            const { time, multiplier, gridSize, oddCount } = levels[levelIdx];
            // Pick main and odd items for this level
            // 1. Pick one main item
            // 2. Pick oddCount distinct odd items (not the main)
            const mainItem = pickMultipleDistinctItems(itemsWithEmoji, 1, usedEmojis)[0];
            usedEmojis.push(getItemEmoji(mainItem));
            const oddItems = pickMultipleDistinctItems(itemsWithEmoji, oddCount, usedEmojis);
            usedEmojis.push(...oddItems.map(item => getItemEmoji(item)));

            // Build the grid: fill with main, then replace oddCount cells with odd items
            const totalCells = gridSize * gridSize;
            const grid = Array(totalCells).fill({ emoji: getItemEmoji(mainItem), id: mainItem.id, isOdd: false });
            // Pick unique indices for odd items
            const oddIndices = [];
            while (oddIndices.length < oddCount) {
                const idx = Math.floor(Math.random() * totalCells);
                if (!oddIndices.includes(idx)) oddIndices.push(idx);
            }
            // Place odd items
            for (let i = 0; i < oddCount; i++) {
                grid[oddIndices[i]] = { emoji: getItemEmoji(oddItems[i]), id: oddItems[i].id, isOdd: true };
            }

            // Build rows of buttons based on grid size
            const rows = [];
            for (let i = 0; i < gridSize; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < gridSize; j++) {
                    const idx = i * gridSize + j;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`work_grid_${levelIdx}_${idx}_${grid[idx].isOdd ? 'odd' : 'main'}`)
                            .setEmoji(grid[idx].emoji)
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                rows.push(row);
            }
            // Prompt embed
            const promptEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`💼 Work Mini-Game! Level ${levelIdx + 1}`)
                .setDescription(`Find and click **${oddCount} odd one${oddCount > 1 ? 's' : ''} out** in the ${gridSize}x${gridSize} emoji grid below! You have **${time / 1000} seconds**.`)
                .setFooter({ text: 'You can work again in 1 hour.' })
                .setTimestamp();
            if (levelIdx === 0) {
                await interaction.reply({ embeds: [promptEmbed], components: rows, flags: MessageFlags.Ephemeral, fetchReply: true });
            } else {
                await interaction.editReply({ embeds: [promptEmbed], components: rows, flags: MessageFlags.Ephemeral });
            }
            // Set up button collector
            const filter = i => i.user.id === userId && i.customId.startsWith(`work_grid_${levelIdx}_`);
            const collector = interaction.channel.createMessageComponentCollector({ filter, time });
            let foundOdds = 0;
            const foundOddIndices = new Set();
            
            collector.on('collect', async i => {
                await i.deferUpdate(); // Defer immediately for fastest response
                if (i.customId.endsWith('_odd') && !foundOddIndices.has(i.customId)) {
                    foundOdds++;
                    foundOddIndices.add(i.customId);
                    
                    // Change the clicked button to green
                    const buttonIndex = parseInt(i.customId.split('_')[3]);
                    const rowIndex = Math.floor(buttonIndex / gridSize);
                    const colIndex = buttonIndex % gridSize;
                    const clickedButton = rows[rowIndex].components[colIndex];
                    clickedButton.setStyle(ButtonStyle.Success);
                    
                    // Update the message with the new button style
                    await interaction.editReply({ embeds: [promptEmbed], components: rows });
                    
                    if (foundOdds === oddCount) {
                        collector.stop('all_found');
                    }
                }
            });
            return new Promise(resolve => {
                collector.on('end', async (collected, reason) => {
                    console.log(`[WORK DEBUG] Level ${levelIdx + 1} ended. Reason: ${reason}, Found: ${foundOdds}/${oddCount}, Collected: ${collected.size}`);
                    if (foundOdds === oddCount) {
                        // Success - immediately move to next level
                        totalMultiplier += multiplier;
                        currentLevel++;
                        if (currentLevel < levels.length) {
                            await interaction.editReply({ embeds: [promptEmbed.setColor(0x00FF00).setTitle(`✅ Level ${levelIdx + 1} Complete!`).setDescription(`Found ${foundOdds}/${oddCount} odd ones!`)] });
                        } else {
                            await interaction.editReply({ embeds: [promptEmbed.setColor(0x00FF00).setTitle('🏆 All Levels Complete!').setDescription(`Found all ${foundOdds} odd ones!`)] });
                        }
                        resolve(true);
                    } else {
                        // Timeout or failure
                        console.log(`[WORK DEBUG] Level ${levelIdx + 1} failed - time ran out or incomplete`);
                        await interaction.editReply({ embeds: [promptEmbed.setColor(0xFFA500).setTitle('❌ Time Up!').setDescription(`You found ${foundOdds}/${oddCount} odd ones. You need to find all of them!`).setFooter({ text: 'You can work again in 1 hour.' })] });
                        resolve(false);
                    }
                });
            });
        }

        // Play levels in sequence
        for (let i = 0; i < levels.length; i++) {
            lastSuccess = await playLevel(i);
            if (!lastSuccess) break;
        }

        // Calculate reward
        const minRewards = [30, 45, 60, 75, 90]; // min for 1, 2, 3, 4, 5 levels completed
        const minBaseReward = minRewards[Math.max(0, currentLevel - 1)] || 30;
        let amount = Math.floor(Math.random() * (maxBaseReward - minBaseReward + 1)) + minBaseReward;
        amount = amount * (totalMultiplier || 0.5); // 0.5x if failed all
        // Debug logging for reward calculation
        console.log(`[WORK DEBUG] minBaseReward: ${minBaseReward}, maxBaseReward: ${maxBaseReward}, totalMultiplier: ${totalMultiplier}, raw amount: ${amount}`);
        // Ensure at least 1 coin is awarded
        amount = Math.max(1, Math.floor(amount));
        // Get balance before work
        const userBefore = interaction.client.economy.getUser(userId, guildId);
        const balanceBefore = userBefore.balance;
        // Grant reward
        try {
            const finalResult = await interaction.client.economy.work(userId, guildId, { amountOverride: amount });
            // Fetch updated balance after work
            const userAfter = interaction.client.economy.getUser(userId, guildId);
            const coinsEarned = userAfter.balance - balanceBefore;
            console.log(`[WORK DEBUG] balanceBefore: ${balanceBefore}, balanceAfter: ${userAfter.balance}, coinsEarned: ${coinsEarned}`);
            const workMessages = [
                { msg: "You worked as a programmer and fixed some bugs!", emoji: "💻" },
                { msg: "You delivered food and got a nice tip!", emoji: "🍔" },
                { msg: "You helped someone with their homework!", emoji: "📚" },
                { msg: "You cleaned the office and found some loose change!", emoji: "🧹" },
                { msg: "You worked overtime and earned extra pay!", emoji: "⏰" },
                { msg: "You freelanced as a graphic designer!", emoji: "🎨" },
                { msg: "You tutored a student in math!", emoji: "🧮" },
                { msg: "You worked as a waiter and got good tips!", emoji: "🍽️" },
                { msg: "You helped move furniture for a neighbor!", emoji: "🪑" },
                { msg: "You worked on a weekend project!", emoji: "🛠️" },
                { msg: "You walked dogs at the animal shelter!", emoji: "🐕" },
                { msg: "You watered plants in the community garden!", emoji: "🌱" },
                { msg: "You fixed a leaky tap for a friend!", emoji: "🔧" },
                { msg: "You baked cakes for a charity sale!", emoji: "🎂" },
                { msg: "You delivered parcels around town!", emoji: "📦" },
                { msg: "You played music at a local event!", emoji: "🎸" },
                { msg: "You painted a mural in the park!", emoji: "🖌️" },
                { msg: "You volunteered at the food bank!", emoji: "🥫" },
                { msg: "You repaired bicycles for kids!", emoji: "🚲" },
                { msg: "You helped organise a street fair!", emoji: "" }
            ];
            const randomWork = workMessages[Math.floor(Math.random() * workMessages.length)];
            const workMultiplier = interaction.client.inventory.getWorkMultiplier(userId, guildId);
            const hasMultiplier = workMultiplier > 1;
            const embed = new EmbedBuilder()
                .setColor(lastSuccess ? 0xFFD700 : 0xFFA500)
                .setTitle(lastSuccess ? '💼 Work Complete!' : '💼 Work Ended')
                .setDescription(`${randomWork.msg}\n\n**Levels completed:** ${currentLevel}/${levels.length}\n**Coins earned:** ${interaction.client.economy.formatCurrency(coinsEarned)}`)
                .addFields(
                    { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(finalResult.user.balance), inline: true },
                    { name: '💎 Net Worth', value: interaction.client.economy.formatCurrency(finalResult.user.balance + finalResult.user.bank), inline: true }
                )
                .setFooter({ text: 'You can work again in 1 hour!' })
                .setTimestamp();
            
            // Set thumbnail with fallback
            try {
                const thumbnailUrl = interaction.client.inventory.getEmojiUrl(randomWork.emoji, interaction.client);
                if (thumbnailUrl) {
                    embed.setThumbnail(thumbnailUrl);
                } else {
                    // Fallback to bot avatar if emoji URL fails
                    embed.setThumbnail(interaction.client.user.displayAvatarURL());
                }
            } catch (error) {
                console.warn(`[WORK] Failed to set thumbnail for emoji ${randomWork.emoji}:`, error);
                // Fallback to bot avatar
                embed.setThumbnail(interaction.client.user.displayAvatarURL());
            }
            
            if (hasMultiplier) {
                embed.addFields({
                    name: '🚀 Work Boost Active!',
                    value: `You're getting ${workMultiplier}x coins from work!`,
                    inline: false
                });
            }
            await interaction.editReply({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
        } catch (error) {
            if (error.code === 10008) {
                return;
            }
            if (error.message && error.message.includes('Work available in')) {
                const cooldownEmbed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('⏰ Work Not Ready')
                    .setDescription(`You need to rest before working again!`)
                    .addFields(
                        { name: '⏳ Time Remaining', value: error.message.replace('Work available in ', ''), inline: true }
                    )
                    .setFooter({ text: 'Work has a 1-hour cooldown' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [cooldownEmbed], components: [], flags: MessageFlags.Ephemeral });
            } else {
                console.error('Error in work mini-game:', error);
                await interaction.editReply({ content: 'There was an error processing your work!', components: [], flags: MessageFlags.Ephemeral });
            }
        }
    },
}; 