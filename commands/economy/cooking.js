const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
const activeRecipeCollectors = {};

const COOKING_BASE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function isRecipeUnlocked(recipe, maxRarity, client, guildId) {
    const resultItem = client.inventory.getItem(recipe.result, guildId);
    const resultRarity = (resultItem && resultItem.rarity) ? resultItem.rarity : 'common';
    const maxRank = RARITY_ORDER.indexOf(maxRarity);
    const resultRank = RARITY_ORDER.indexOf(resultRarity);
    if (maxRank === -1) return resultRank <= RARITY_ORDER.indexOf('common');
    if (resultRank === -1) return true;
    return resultRank <= maxRank;
}

function getUnlockedRecipes(recipes, bestTool, client, guildId) {
    const maxRarity = bestTool ? bestTool.rarity : 'common';
    return recipes.filter(r => isRecipeUnlocked(r, maxRarity, client, guildId));
}

async function showRecipeList(interaction, client) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // Check cooking cooldown
    const user = client.economy.getUser(userId, guildId);
    const lastCook = user.last_cook ? new Date(user.last_cook) : null;
    const cooldownMultiplier = client.inventory.getCookingCooldown(userId, guildId);
    const actualCooldownMs = COOKING_BASE_COOLDOWN_MS * cooldownMultiplier;
    if (lastCook) {
        const elapsed = Date.now() - lastCook.getTime();
        if (elapsed < actualCooldownMs) {
            const timeLeftMs = actualCooldownMs - elapsed;
            const minutes = Math.floor(timeLeftMs / (60 * 1000));
            const seconds = Math.floor((timeLeftMs % (60 * 1000)) / 1000);
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('🍳 Cooking Station')
                .setDescription(`You need to rest your kitchen! You can cook again in **${minutes}m ${seconds}s**.`)
                .setFooter({ text: 'Buy a cooking tool from the shop to reduce cooldown' })
                .setTimestamp();
            const hasReplied = interaction.replied || interaction.deferred;
            if (hasReplied) {
                await interaction.editReply({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            return;
        }
    }

    const recipes = require('../../data/recipes.json');
    if (!recipes || recipes.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🍳 Cooking Station')
            .setDescription('No recipes are available at the moment.')
            .setTimestamp();
        const hasReplied = interaction.replied || interaction.deferred;
        if (hasReplied) await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        else await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }
    const bestToolForUnlock = client.inventory.getBestCookingTool(userId, guildId);
    const unlockedRecipes = getUnlockedRecipes(recipes, bestToolForUnlock, client, guildId);
    if (!unlockedRecipes.length) {
        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🍳 Cooking Station')
            .setDescription('You have no unlocked recipes. Common recipes are always available; buy a cooking tool from the shop to unlock more.')
            .setFooter({ text: 'Use /shop to buy cooking tools' })
            .setTimestamp();
        // Track if this is the initial reply
        let hasReplied = interaction.replied || interaction.deferred;
        if (hasReplied) {
            await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            hasReplied = true;
        }
        return;
    }
    const inventory = client.inventory.getUserInventory(userId, guildId);
    const inventoryLookup = {};
    for (const item of inventory) {
        const key = item.variant ? `${item.id}_${item.variant}` : item.id;
        if (!inventoryLookup[key]) {
            inventoryLookup[key] = { ...item };
        } else {
            inventoryLookup[key].quantity += item.quantity;
        }
    }
    const craftableRecipes = unlockedRecipes.filter(recipe => {
        return recipe.ingredients.every(ingredient => {
            const totalQty = Object.entries(inventoryLookup)
                .filter(([key, item]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                .reduce((sum, [key, item]) => sum + item.quantity, 0);
            return totalQty >= ingredient.quantity;
        });
    });
    const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
    const sortedRecipes = craftableRecipes.sort((a, b) => {
        const resultA = client.inventory.getItem(a.result, guildId);
        const resultB = client.inventory.getItem(b.result, guildId);
        const rarityA = (resultA && resultA.rarity) ? resultA.rarity : 'common';
        const rarityB = (resultB && resultB.rarity) ? resultB.rarity : 'common';
        const rankA = rarityOrder[rarityA] || 99;
        const rankB = rarityOrder[rarityB] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
    });
    if (sortedRecipes.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🍳 Cooking Station')
            .setDescription('You don\'t have enough ingredients to craft any recipes!\n\n**To cook items, you need:**\n• Fish from fishing\n• Crops from farming\n• Other ingredients from the shop\n\n**Check your inventory with `/inventory`**')
            .setFooter({ text: 'Use /fish and /farm to gather ingredients' })
            .setTimestamp();
        // Track if this is the initial reply
        let hasReplied = interaction.replied || interaction.deferred;
        if (hasReplied) {
            await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            hasReplied = true;
        }
        return;
    }
    const recipeOptions = sortedRecipes.map(recipe => {
        const resultItem = client.inventory.getItem(recipe.result, guildId);
        const emojiRaw = (resultItem && resultItem.emoji) ? resultItem.emoji : (recipe.emoji || '🍳');
        const type = recipe.type === 'buff' ? 'Consumable' : 'Sellable';
        const customMatch = typeof emojiRaw === 'string' && emojiRaw.match(/^<a?:(\w+):(\d+)>$/);
        const emojiApi = customMatch
            ? { id: customMatch[2], name: customMatch[1] }
            : { name: emojiRaw };
        return {
            label: recipe.name,
            description: `${type} • ${recipe.ingredients.length} ingredients`,
            value: recipe.name,
            emoji: emojiApi
        };
    });
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cook_recipe_select')
        .setPlaceholder('Choose a recipe to cook...')
        .addOptions(recipeOptions);
    const bestTool = client.inventory.getBestCookingTool(userId, guildId);
    const actualCooldownMin = Math.ceil((COOKING_BASE_COOLDOWN_MS * client.inventory.getCookingCooldown(userId, guildId)) / (60 * 1000));
    const toolLabel = bestTool ? `${bestTool.name} (${(bestTool.rarity || 'common').charAt(0).toUpperCase() + (bestTool.rarity || 'common').slice(1)})` : 'None (common recipes only)';
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle('🍳 Cooking Station')
        .setDescription(`You can craft **${sortedRecipes.length}** recipes!\n\nSelect a recipe from the dropdown below to see the ingredients and craft it.`)
        .addFields(
            { name: '📦 Available Recipes', value: `${sortedRecipes.length} craftable`, inline: true },
            { name: 'Consumable', value: `${sortedRecipes.filter(r => r.type === 'buff').length}`, inline: true },
            { name: 'Sellable', value: `${sortedRecipes.filter(r => r.type === 'sellable').length}`, inline: true },
            { name: '🍳 Cooking Tool', value: toolLabel, inline: true },
            { name: '⏱️ Cooldown', value: `${actualCooldownMin} min`, inline: true }
        )
        .setFooter({ text: bestTool ? 'Buy better tools from the shop to unlock more recipes and reduce cooldown' : 'You\'re cooking with no tool. Buy a cooking tool from the shop to unlock more recipes and reduce cooldown.' })
        .setTimestamp();
    // Track if this is the initial reply
    let hasReplied = interaction.replied || interaction.deferred;
    if (hasReplied) {
        await interaction.editReply({ 
            embeds: [embed], 
            components: [row], 
            flags: MessageFlags.Ephemeral 
        });
    } else {
        await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            flags: MessageFlags.Ephemeral 
        });
        hasReplied = true;
    }
    // Set up collector for recipe selection
    const filter = i => i.user.id === userId && i.customId === 'cook_recipe_select';
    if (activeRecipeCollectors[interaction.user.id]) {
        activeRecipeCollectors[interaction.user.id].stop();
        delete activeRecipeCollectors[interaction.user.id];
    }
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });
    activeRecipeCollectors[interaction.user.id] = collector;
    collector.on('end', () => {
        delete activeRecipeCollectors[interaction.user.id];
    });
    collector.on('collect', async i => {
        try {
            await i.deferUpdate();
        } catch (err) {
            if (err.code === 10062 || err.code === 40060) return;
            throw err;
        }
        const selectedRecipeName = i.values[0];
        const selectedRecipe = recipes.find(r => r.name === selectedRecipeName);
        if (!selectedRecipe) {
            await i.editReply({
                content: '❌ Recipe not found!',
                embeds: [],
                components: []
            });
            return;
        }
        // Check if user still has ingredients (in case they used them)
        const currentInventory = client.inventory.getUserInventory(userId, guildId);
        const currentInventoryLookup = {};
        for (const item of currentInventory) {
            const key = item.variant ? `${item.id}_${item.variant}` : item.id;
            if (!currentInventoryLookup[key]) {
                currentInventoryLookup[key] = { ...item };
            } else {
                currentInventoryLookup[key].quantity += item.quantity;
            }
        }
        const canStillCraft = selectedRecipe.ingredients.every(ingredient => {
            const totalQty = Object.entries(currentInventoryLookup)
                .filter(([key, item]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                .reduce((sum, [key, item]) => sum + item.quantity, 0);
            return totalQty >= ingredient.quantity;
        });
        if (!canStillCraft) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('❌ Missing Ingredients')
                .setDescription('You no longer have enough ingredients to craft this recipe!')
                .setFooter({ text: 'Ingredients may have been used or sold' })
                .setTimestamp();
            await i.editReply({
                embeds: [embed],
                components: []
            });
            return;
        }
        // Show recipe details and craft button
        await module.exports.showRecipeDetails(i, selectedRecipe, currentInventoryLookup, client);
    });
    collector.on('end', collected => {
        if (collected.size === 0) {
            interaction.editReply({
                content: '⏰ Recipe selection timed out!',
                embeds: [],
                components: []
            }).catch(() => {});
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cook')
        .setDescription('Cook items using recipes and ingredients from your inventory')
        .addSubcommand(sub =>
            sub.setName('recipes')
                .setDescription('View all available cooking recipes')
        )
        .addSubcommand(sub =>
            sub.setName('make')
                .setDescription('Cook items using recipes and ingredients from your inventory')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand(false);
        if (sub === 'recipes') {
            // Show all recipes, 1 per page (like shop)
            const recipes = require('../../data/recipes.json');
            if (!recipes || recipes.length === 0) {
                return interaction.reply({
                    content: '❌ No recipes are available at the moment!',
                    flags: MessageFlags.Ephemeral
                });
            }
            const client = interaction.client;
            const guildId = interaction.guild?.id;

            const categories = [
                { label: 'All', value: 'all', emoji: '📋' },
                { label: 'Consumable', value: 'buff', emoji: '⚡' },
                { label: 'Sellable', value: 'sellable', emoji: '💰' }
            ];

            function getFilteredRecipes(category) {
                if (category === 'all') return recipes;
                return recipes.filter(r => r.type === category);
            }

            function sortRecipesByRarityThenName(recipeList) {
                const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
                return recipeList.slice().sort((a, b) => {
                    const resultA = client.inventory.getItem(a.result, guildId);
                    const resultB = client.inventory.getItem(b.result, guildId);
                    const rarityA = (resultA && resultA.rarity) ? resultA.rarity : 'common';
                    const rarityB = (resultB && resultB.rarity) ? resultB.rarity : 'common';
                    const rankA = rarityOrder[rarityA] || 99;
                    const rankB = rarityOrder[rarityB] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    const nameCmp = a.name.localeCompare(b.name);
                    if (nameCmp !== 0) return nameCmp;
                    return (a.result || '').localeCompare(b.result || '');
                });
            }

            function createRecipePages(recipeList, userId) {
                const bestTool = client.inventory.getBestCookingTool(userId, guildId);
                const inventory = client.inventory.getUserInventory(userId, guildId);
                const inventoryLookup = {};
                for (const item of inventory) {
                    const key = item.variant ? `${item.id}_${item.variant}` : item.id;
                    if (!inventoryLookup[key]) {
                        inventoryLookup[key] = { ...item };
                    } else {
                        inventoryLookup[key].quantity += item.quantity;
                    }
                }
                function canMake(recipe) {
                    return recipe.ingredients.every(ingredient => {
                        const totalQty = Object.entries(inventoryLookup)
                            .filter(([key, item]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                            .reduce((sum, [key, item]) => sum + item.quantity, 0);
                        return totalQty >= ingredient.quantity;
                    });
                }
                const pages = [];
                const effectNames = {
                    fishing_boost: 'Fishing Boost',
                    work_multiplier: 'Work Multiplier',
                    luck_boost: 'Luck Boost',
                    health_boost: 'Health Boost'
                };
                for (let i = 0; i < recipeList.length; i++) {
                    const recipe = recipeList[i];
                    const resultItem = client.inventory.getItem(recipe.result, guildId);
                    const emoji = (resultItem && resultItem.emoji) ? resultItem.emoji : (recipe.emoji || '🍳');
                    const type = recipe.type === 'buff' ? 'Consumable' : 'Sellable';
                    const ingredientsStr = recipe.ingredients.map(ing => {
                        const item = client.inventory.getItem(ing.item, guildId);
                        const itemEmoji = item ? client.inventory.getItemEmoji(item) : '❓';
                        const itemName = item ? item.name : ing.item;
                        return `${ing.quantity}x ${itemEmoji} ${itemName}`;
                    }).join(', ');
                    let resultStr = '';
                    if (recipe.type === 'buff') {
                        const buff = recipe.buff;
                        const effectLabel = effectNames[buff.effect_type] || buff.effect_type;
                        resultStr = `${effectLabel}: ${buff.effect_value}x for ${buff.duration_hours} hour${buff.duration_hours === 1 ? '' : 's'}`;
                    } else {
                        resultStr = `Sells for ${client.economy.formatCurrency(recipe.sell_value)}`;
                    }
                    const description = (resultItem && resultItem.description) ? resultItem.description : 'A crafted dish.';
                    const rarity = (resultItem && resultItem.rarity) ? resultItem.rarity : 'common';
                    const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
                    const unlocked = isRecipeUnlocked(recipe, bestTool ? bestTool.rarity : 'common', client, guildId);
                    const canMakeThis = unlocked && canMake(recipe);
                    const statusStr = !unlocked ? `🔒 Locked - Requires ${rarityName} or better tool` : (canMakeThis ? '✅ Can make' : '❌ Cannot make');
                    const emojiToUse = (resultItem && resultItem.emoji) ? resultItem.emoji : recipe.emoji;
                    const emojiUrl = client.inventory.getEmojiUrl(emojiToUse, client);
                    const embed = new EmbedBuilder()
                        .setColor(client.inventory.getRarityColour(rarity))
                        .setTitle(`${emoji} ${recipe.name}`)
                        .setDescription(description)
                        .addFields(
                            { name: '🥗 Ingredients', value: ingredientsStr, inline: false },
                            { name: '⭐ Rarity', value: rarityName, inline: true },
                            { name: '📋 Type', value: type, inline: true },
                            { name: '✨ Result', value: resultStr, inline: true },
                            { name: '📄 Page', value: `${i + 1}/${recipeList.length}`, inline: true },
                            { name: '🛒 Status', value: statusStr, inline: true }
                        )
                        .setFooter({ text: 'Use the arrow buttons to navigate • Use /cook make to craft • Locked recipes require a higher-rarity cooking tool from the shop' })
                        .setTimestamp();
                    if (emojiUrl) embed.setThumbnail(emojiUrl);
                    pages.push({ embed, recipe, pageNumber: i + 1, totalPages: recipeList.length });
                }
                return pages;
            }

            function getRecipePaginationButtons(pageNumber, totalPages) {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('cooking_recipes_prev')
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pageNumber <= 1),
                    new ButtonBuilder()
                        .setCustomId('cooking_recipes_next')
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pageNumber >= totalPages)
                );
            }

            const categoryMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cooking_recipes_category')
                    .setPlaceholder('🔍 Filter by category...')
                    .addOptions(categories)
            );

            const userId = interaction.user.id;
            let currentCategory = 'all';
            let currentPages = createRecipePages(sortRecipesByRarityThenName(getFilteredRecipes(currentCategory)), userId);
            let page = 0;

            if (currentPages.length === 0) {
                return interaction.reply({
                    content: '❌ No recipes found for this category.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const currentPage = currentPages[page];
            const paginationRow = getRecipePaginationButtons(currentPage.pageNumber, currentPage.totalPages);

            await interaction.reply({
                embeds: [currentPage.embed],
                components: [categoryMenu, paginationRow],
                flags: MessageFlags.Ephemeral
            });

            const filter = i => i.user.id === interaction.user.id && (i.customId === 'cooking_recipes_category' || i.customId === 'cooking_recipes_prev' || i.customId === 'cooking_recipes_next');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    if (i.customId === 'cooking_recipes_category') {
                        currentCategory = i.values[0];
                        currentPages = createRecipePages(sortRecipesByRarityThenName(getFilteredRecipes(currentCategory)), userId);
                        page = 0;
                        if (currentPages.length === 0) {
                            const noRecipesEmbed = new EmbedBuilder()
                                .setColor(0xFF6B6B)
                                .setTitle('🔍 No Recipes Found')
                                .setDescription(`No recipes in category: **${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}**`)
                                .setFooter({ text: 'Try a different category' })
                                .setTimestamp();
                            await i.editReply({
                                embeds: [noRecipesEmbed],
                                components: [categoryMenu, getRecipePaginationButtons(1, 1)]
                            });
                            return;
                        }
                    } else if (i.customId === 'cooking_recipes_prev') {
                        page = page > 0 ? page - 1 : currentPages.length - 1;
                    } else if (i.customId === 'cooking_recipes_next') {
                        page = page + 1 < currentPages.length ? page + 1 : 0;
                    }
                    const display = currentPages[page];
                    await i.editReply({
                        embeds: [display.embed],
                        components: [categoryMenu, getRecipePaginationButtons(display.pageNumber, display.totalPages)]
                    });
                } catch (err) {
                    if (err.code === 10062 || err.code === 40060) return;
                    throw err;
                }
            });

            collector.on('end', () => {
                const disabled = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('cooking_recipes_prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('cooking_recipes_next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                interaction.editReply({ components: [categoryMenu, disabled] }).catch(() => {});
            });
            return;
        }
        // Default to 'make' subcommand for interactive cooking
        if (sub === 'make') {
            await showRecipeList(interaction, interaction.client);
            return;
        }
    },

    async showRecipeDetails(interaction, recipe, inventoryLookup, client) {
        const resultItem = client.inventory.getItem(recipe.result, interaction.guild.id);
        const emoji = (resultItem && resultItem.emoji) ? resultItem.emoji : (recipe.emoji || '🍳');
        const type = recipe.type === 'buff' ? 'Consumable Item' : 'Sellable Item';
        
        // Create ingredients list
        const ingredientsList = recipe.ingredients.map(ingredient => {
            const item = client.inventory.getItem(ingredient.item, interaction.guild.id);
            // Sum all inventory items with the same base ID (ignore variant)
            const userQty = Object.entries(inventoryLookup)
                .filter(([key, invItem]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                .reduce((sum, [key, invItem]) => sum + invItem.quantity, 0);
            const hasEnough = userQty >= ingredient.quantity;
            const status = hasEnough ? '✅' : '❌';
            const itemEmoji = item ? client.inventory.getItemEmoji(item) : '❓';
            const itemName = item ? item.name : ingredient.item;
            return `${status} ${itemEmoji} **${itemName}** (${ingredient.quantity}x) - You have: ${userQty}`;
        }).join('\n');

        // Create result description
        let resultDescription = '';
        if (recipe.type === 'buff') {
            const buff = recipe.buff;
            const effectName = {
                'fishing_boost': '🎣 Fishing Boost',
                'work_multiplier': '⚡ Work Multiplier',
                'luck_boost': '🍀 Luck Boost',
                'health_boost': '❤️ Health Boost'
            }[buff.effect_type] || buff.effect_type;
            
            resultDescription = `**${effectName}**: ${buff.effect_value}x for ${buff.duration_hours} hours`;
        } else if (recipe.type === 'sellable') {
            resultDescription = `**Sell Value**: ${client.economy.formatCurrency(recipe.sell_value)}`;
        }

        // Get result item for thumbnail and rarity colour (resultItem already fetched above for emoji)
        const embedColor = resultItem && resultItem.rarity
            ? client.inventory.getRarityColour(resultItem.rarity)
            : (recipe.type === 'buff' ? 0x4CAF50 : 0xFF9800);

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${emoji} ${recipe.name}`)
            .setDescription(`**Type**: ${type}\n\n**Result**:\n${resultDescription}`)
            .addFields(
                { name: '📋 Ingredients Required', value: ingredientsList, inline: false }
            )
            .setFooter({ text: 'Click "Cook Recipe" to craft this item' })
            .setTimestamp();

        // Set thumbnail to food emoji if available
        let emojiToUse = (resultItem && resultItem.emoji) ? resultItem.emoji : recipe.emoji;
        let emojiUrl = client.inventory.getEmojiUrl(emojiToUse, client);
        if (emojiUrl) {
            embed.setThumbnail(emojiUrl);
        }

        const cookButton = new ButtonBuilder()
            .setCustomId(`cook_craft_${recipe.name}`)
            .setLabel('🍳 Cook Recipe')
            .setStyle(ButtonStyle.Success);

        const backButton = new ButtonBuilder()
            .setCustomId('cook_back_to_list')
            .setLabel('← Back to Recipes')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(cookButton, backButton);

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

        // Set up collector for button interactions
        const filter = i => i.user.id === interaction.user.id && 
            (i.customId === `cook_craft_${recipe.name}` || i.customId === 'cook_back_to_list');
        
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();

                if (i.customId === 'cook_back_to_list') {
                    await showRecipeList(i, client);
                    return;
                }

                if (i.customId === `cook_craft_${recipe.name}`) {
                    await this.craftRecipe(i, recipe, interaction.guild.id, client);
                }
            } catch (err) {
                if (err.code === 10062 || err.code === 40060) return;
                throw err;
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: '⏰ Recipe crafting timed out!',
                    embeds: [],
                    components: []
                }).catch(() => {});
            }
        });
    },

    async craftRecipe(interaction, recipe, guildId, client) {
        const userId = interaction.user.id;

        try {
            // Check cooking cooldown
            const user = client.economy.getUser(userId, guildId);
            const lastCook = user.last_cook ? new Date(user.last_cook) : null;
            const cooldownMultiplier = client.inventory.getCookingCooldown(userId, guildId);
            const actualCooldownMs = COOKING_BASE_COOLDOWN_MS * cooldownMultiplier;
            if (lastCook && (Date.now() - lastCook.getTime()) < actualCooldownMs) {
                const timeLeftMs = actualCooldownMs - (Date.now() - lastCook.getTime());
                const minutes = Math.floor(timeLeftMs / (60 * 1000));
                const seconds = Math.floor((timeLeftMs % (60 * 1000)) / 1000);
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ On Cooldown')
                    .setDescription(`You can cook again in **${minutes}m ${seconds}s**.`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            // Check recipe is unlocked for this user's tool
            const bestTool = client.inventory.getBestCookingTool(userId, guildId);
            if (!isRecipeUnlocked(recipe, bestTool ? bestTool.rarity : 'common', client, guildId)) {
                const resultItem = client.inventory.getItem(recipe.result, guildId);
                const resultRarity = (resultItem && resultItem.rarity) ? resultItem.rarity : 'common';
                const rarityName = resultRarity.charAt(0).toUpperCase() + resultRarity.slice(1);
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ Recipe Locked')
                    .setDescription(`This recipe requires a **${rarityName}** or better cooking tool. Buy one from the shop!`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            // Double-check ingredients
            const currentInventory = client.inventory.getUserInventory(userId, guildId);
            const currentInventoryLookup = {};
            for (const item of currentInventory) {
                const key = item.variant ? `${item.id}_${item.variant}` : item.id;
                if (!currentInventoryLookup[key]) {
                    currentInventoryLookup[key] = { ...item };
                } else {
                    currentInventoryLookup[key].quantity += item.quantity;
                }
            }

            const canCraft = recipe.ingredients.every(ingredient => {
                const totalQty = Object.entries(currentInventoryLookup)
                    .filter(([key, item]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                    .reduce((sum, [key, item]) => sum + item.quantity, 0);
                return totalQty >= ingredient.quantity;
            });

            if (!canCraft) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('❌ Missing Ingredients')
                    .setDescription('You no longer have enough ingredients to craft this recipe!')
                    .setFooter({ text: 'Ingredients may have been used or sold' })
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [embed],
                    components: []
                });
                return;
            }

            // Remove ingredients
            for (const ingredient of recipe.ingredients) {
                client.inventory.removeItem(userId, guildId, ingredient.item, ingredient.quantity);
            }

            // Add crafted item
            const resultItem = client.inventory.getItem(recipe.result, guildId);
            if (!resultItem) {
                // If the result item doesn't exist in the shop, create a temporary item
                const tempItem = {
                    id: recipe.result,
                    name: recipe.name,
                    description: `Crafted ${recipe.name}`,
                    type: recipe.type,
                    rarity: 'common',
                    price: recipe.sell_value || 10,
                    max_quantity: 999,
                    effect_type: recipe.buff?.effect_type,
                    effect_value: recipe.buff?.effect_value,
                    duration_hours: recipe.buff?.duration_hours
                };
                
                // Add to user's inventory (this will handle the item creation)
                await client.inventory.addItem(userId, guildId, recipe.result, 1, interaction, client);
            } else {
                await client.inventory.addItem(userId, guildId, recipe.result, 1, interaction, client);
            }

            client.economy.setLastCook(userId, guildId);

            // Create success embed
            const type = recipe.type === 'buff' ? 'Consumable Item' : 'Sellable Item';
            const emojiToUse = (resultItem && resultItem.emoji) ? resultItem.emoji : (recipe.emoji || '🍳');
            
            let resultDescription = '';
            if (recipe.type === 'buff') {
                const buff = recipe.buff;
                const effectName = {
                    'fishing_boost': '🎣 Fishing Boost',
                    'work_multiplier': '⚡ Work Multiplier',
                    'luck_boost': '🍀 Luck Boost',
                    'health_boost': '❤️ Health Boost'
                }[buff.effect_type] || buff.effect_type;
                
                resultDescription = `**${effectName}**: ${buff.effect_value}x for ${buff.duration_hours} hours`;
            } else if (recipe.type === 'sellable') {
                resultDescription = `**Sell Value**: ${client.economy.formatCurrency(recipe.sell_value)}`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('✅ Recipe Crafted Successfully!')
                .setDescription(`${emojiToUse} **${recipe.name}** has been crafted!\n\n**Type**: ${type}\n**Effect**: ${resultDescription}`)
                .addFields(
                    { name: '📋 Ingredients Used', value: recipe.ingredients.map(ingredient => {
                        const item = client.inventory.getItem(ingredient.item, guildId);
                        const itemEmoji = item ? client.inventory.getItemEmoji(item) : '❓';
                        const itemName = item ? item.name : ingredient.item;
                        return `${itemEmoji} **${itemName}** (${ingredient.quantity}x)`;
                    }).join('\n'), inline: false }
                )
                .setFooter({ text: 'Use /use to activate consumable items or /sell to sell items' })
                .setTimestamp();
            let emojiUrl = client.inventory.getEmojiUrl(emojiToUse, client);
            if (emojiUrl) {
                embed.setThumbnail(emojiUrl);
            }

            const newCookButton = new ButtonBuilder()
                .setCustomId('cook_another')
                .setLabel('Back to Cooking Station')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(newCookButton);

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Set up collector for post-crafting actions
            const filter = i => i.user.id === interaction.user.id && i.customId === 'cook_another';
            
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'cook_another') {
                        await showRecipeList(i, client);
                    }
                } catch (err) {
                    if (err.code === 10062 || err.code === 40060) return;
                    throw err;
                }
            });

        } catch (error) {
            console.error('Error crafting recipe:', error);
            await interaction.editReply({
                content: '❌ There was an error crafting the recipe!',
                embeds: [],
                components: []
            });
        }
    }
}; 