const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
const activeRecipeCollectors = {};

async function showRecipeList(interaction, client) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const recipes = require('../../data/recipes.json');
    if (!recipes || recipes.length === 0) {
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
    const craftableRecipes = recipes.filter(recipe => {
        return recipe.ingredients.every(ingredient => {
            const totalQty = Object.entries(inventoryLookup)
                .filter(([key, item]) => key === ingredient.item || key.startsWith(ingredient.item + '_'))
                .reduce((sum, [key, item]) => sum + item.quantity, 0);
            return totalQty >= ingredient.quantity;
        });
    });
    const sortedRecipes = craftableRecipes.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'buff' ? -1 : 1;
        }
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
        const emoji = recipe.emoji || '🍳';
        const type = recipe.type === 'buff' ? '⚡ Buff' : '💰 Sellable';
        return {
            label: `${emoji} ${recipe.name}`,
            description: `${type} • ${recipe.ingredients.length} ingredients`,
            value: recipe.name
        };
    });
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cook_recipe_select')
        .setPlaceholder('Choose a recipe to cook...')
        .addOptions(recipeOptions);
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle('🍳 Cooking Station')
        .setDescription(`You can craft **${sortedRecipes.length}** recipes!\n\nSelect a recipe from the dropdown below to see the ingredients and craft it.`)
        .addFields(
            { name: '📦 Available Recipes', value: `${sortedRecipes.length} craftable`, inline: true },
            { name: '⚡ Buff Items', value: `${sortedRecipes.filter(r => r.type === 'buff').length}`, inline: true },
            { name: '💰 Sellable Items', value: `${sortedRecipes.filter(r => r.type === 'sellable').length}`, inline: true }
        )
        .setFooter({ text: 'Select a recipe to begin cooking' })
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
        .setName('cooking')
        .setDescription('Cooking: craft items using recipes and ingredients from your inventory')
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
            // Show all recipes, not just craftable
            const recipes = require('../../data/recipes.json');
            if (!recipes || recipes.length === 0) {
                return interaction.reply({
                    content: '❌ No recipes are available at the moment!',
                    flags: MessageFlags.Ephemeral
                });
            }
            // Category filter options
            const categories = [
                { label: 'All', value: 'all', emoji: '📋' },
                { label: 'Buff', value: 'buff', emoji: '⚡' },
                { label: 'Sellable', value: 'sellable', emoji: '💰' }
            ];
            // Default filter
            let currentCategory = 'all';
            let currentPage = 0;
            const pageSize = 5;
            // Helper to get filtered recipes
            function getFilteredRecipes(category) {
                if (category === 'all') return recipes;
                return recipes.filter(r => r.type === category);
            }
            // Helper to build embed for a page
            function buildEmbed(category, page) {
                const filtered = getFilteredRecipes(category);
                const totalPages = Math.ceil(filtered.length / pageSize);
                const start = page * pageSize;
                const end = start + pageSize;
                const pageRecipes = filtered.slice(start, end);
                const recipeList = pageRecipes.map(recipe => {
                    const emoji = recipe.emoji || '🍳';
                    const type = recipe.type === 'buff' ? '⚡ Buff' : '💰 Sellable';
                    const ingredients = recipe.ingredients.map(ing => {
                        const item = interaction.client.inventory.getItem(ing.item, interaction.guild?.id);
                        const itemEmoji = item ? interaction.client.inventory.getItemEmoji(item) : '❓';
                        const itemName = item ? item.name : ing.item;
                        return `${ing.quantity}x ${itemEmoji} ${itemName}`;
                    }).join(', ');
                    let result = '';
                    if (recipe.type === 'buff') {
                        const buff = recipe.buff;
                        const effectNames = {
                            fishing_boost: 'Fishing Boost',
                            work_multiplier: 'Work Multiplier',
                            luck_boost: 'Luck Boost',
                            health_boost: 'Health Boost'
                        };
                        const effectLabel = effectNames[buff.effect_type] || buff.effect_type;
                        result = `**${type}**: ${effectLabel}: ${buff.effect_value}x for ${buff.duration_hours} hour${buff.duration_hours === 1 ? '' : 's'}`;
                    } else if (recipe.type === 'sellable') {
                        result = `**${type}**: Sells for ${recipe.sell_value}`;
                    }
                    return `${emoji} **${recipe.name}**\nIngredients: ${ingredients}\n${result}`;
                }).join('\n\n');
                return new EmbedBuilder()
                    .setColor(0x4CAF50)
                    .setTitle('🍳 All Cooking Recipes')
                    .setDescription(recipeList.length > 0 ? recipeList : 'No recipes found.')
                    .setFooter({ text: `Page ${page + 1} of ${totalPages} | Category: ${category.charAt(0).toUpperCase() + category.slice(1)}` })
                    .setTimestamp();
            }
            // Build initial components
            const categoryMenu = new StringSelectMenuBuilder()
                .setCustomId('cooking_recipes_category')
                .setPlaceholder('Filter by category...')
                .addOptions(categories);
            const prevButton = new ButtonBuilder()
                .setCustomId('cooking_recipes_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);
            const nextButton = new ButtonBuilder()
                .setCustomId('cooking_recipes_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary);
            // Helper to update button states
            function updateButtonStates(category, page) {
                const filtered = getFilteredRecipes(category);
                const totalPages = Math.ceil(filtered.length / pageSize);
                prevButton.setDisabled(page === 0);
                nextButton.setDisabled(page >= totalPages - 1);
            }
            updateButtonStates(currentCategory, currentPage);
            const row1 = new ActionRowBuilder().addComponents(categoryMenu);
            const row2 = new ActionRowBuilder().addComponents(prevButton, nextButton);
            await interaction.reply({
                embeds: [buildEmbed(currentCategory, currentPage)],
                components: [row1, row2],
                flags: MessageFlags.Ephemeral
            });
            // Collector for navigation
            const filter = i => i.user.id === interaction.user.id && (i.customId === 'cooking_recipes_category' || i.customId === 'cooking_recipes_prev' || i.customId === 'cooking_recipes_next');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });
            collector.on('collect', async i => {
                try {
                    if (i.customId === 'cooking_recipes_category') {
                        currentCategory = i.values[0];
                        currentPage = 0;
                    } else if (i.customId === 'cooking_recipes_prev') {
                        currentPage = Math.max(0, currentPage - 1);
                    } else if (i.customId === 'cooking_recipes_next') {
                        const filtered = getFilteredRecipes(currentCategory);
                        const totalPages = Math.ceil(filtered.length / pageSize);
                        currentPage = Math.min(totalPages - 1, currentPage + 1);
                    }
                    updateButtonStates(currentCategory, currentPage);
                    await i.update({
                        embeds: [buildEmbed(currentCategory, currentPage)],
                        components: [row1, row2]
                    });
                } catch (err) {
                    if (err.code === 10062 || err.code === 40060) return;
                    throw err;
                }
            });
            collector.on('end', () => {
                // Disable components after timeout
                row1.components.forEach(c => c.setDisabled(true));
                row2.components.forEach(c => c.setDisabled(true));
                interaction.editReply({ components: [row1, row2] }).catch(() => {});
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
        const emoji = recipe.emoji || '🍳';
        const type = recipe.type === 'buff' ? '⚡ Buff Item' : '💰 Sellable Item';
        
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

        const embed = new EmbedBuilder()
            .setColor(recipe.type === 'buff' ? 0x4CAF50 : 0xFF9800)
            .setTitle(`${emoji} ${recipe.name}`)
            .setDescription(`**Type**: ${type}\n\n**Result**:\n${resultDescription}`)
            .addFields(
                { name: '📋 Ingredients Required', value: ingredientsList, inline: false }
            )
            .setFooter({ text: 'Click "Cook Recipe" to craft this item' })
            .setTimestamp();

        // Set thumbnail to food emoji if available
        const resultItem = client.inventory.getItem(recipe.result, interaction.guild.id);
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

            // Create success embed
            const emoji = recipe.emoji || '🍳';
            const type = recipe.type === 'buff' ? '⚡ Buff Item' : '💰 Sellable Item';
            
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
                .setDescription(`${emoji} **${recipe.name}** has been crafted!\n\n**Type**: ${type}\n**Effect**: ${resultDescription}`)
                .addFields(
                    { name: '📋 Ingredients Used', value: recipe.ingredients.map(ingredient => {
                        const item = client.inventory.getItem(ingredient.item, guildId);
                        const itemEmoji = item ? client.inventory.getItemEmoji(item) : '❓';
                        const itemName = item ? item.name : ingredient.item;
                        return `${itemEmoji} **${itemName}** (${ingredient.quantity}x)`;
                    }).join('\n'), inline: false }
                )
                .setFooter({ text: 'Use /use to activate buff items or /sell to sell items' })
                .setTimestamp();

            let emojiToUse = (resultItem && resultItem.emoji) ? resultItem.emoji : recipe.emoji;
            let emojiUrl = client.inventory.getEmojiUrl(emojiToUse, client);
            if (emojiUrl) {
                embed.setThumbnail(emojiUrl);
            }

            const newCookButton = new ButtonBuilder()
                .setCustomId('cook_another')
                .setLabel('🍳 Cook Another')
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