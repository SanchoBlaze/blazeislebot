const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');

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
            // Build a list of recipes
            const recipeList = recipes.map(recipe => {
                const emoji = recipe.emoji || '🍳';
                const type = recipe.type === 'buff' ? '⚡ Buff' : '💰 Sellable';
                const ingredients = recipe.ingredients.map(ing => `${ing.quantity}x <${ing.item}>`).join(', ');
                let result = '';
                if (recipe.type === 'buff') {
                    const buff = recipe.buff;
                    result = `**${type}**: ${buff.effect_type} ${buff.effect_value}x for ${buff.duration_hours}h`;
                } else if (recipe.type === 'sellable') {
                    result = `**${type}**: Sells for ${recipe.sell_value}`;
                }
                return `${emoji} **${recipe.name}**\nIngredients: ${ingredients}\n${result}`;
            }).join('\n\n');
            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('🍳 All Cooking Recipes')
                .setDescription(recipeList.length > 0 ? recipeList : 'No recipes found.')
                .setFooter({ text: 'Use /cooking make to craft recipes you have ingredients for.' })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        // Default to 'make' subcommand for interactive cooking
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            // Load recipes
            const recipes = require('../../data/recipes.json');
            
            if (!recipes || recipes.length === 0) {
                return interaction.reply({
                    content: '❌ No recipes are available at the moment!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Get user's inventory
            const inventory = interaction.client.inventory.getUserInventory(userId, guildId);
            
            // Create inventory lookup for quick access
            const inventoryLookup = {};
            for (const item of inventory) {
                const key = item.variant ? `${item.id}_${item.variant}` : item.id;
                if (!inventoryLookup[key]) {
                    inventoryLookup[key] = { ...item };
                } else {
                    inventoryLookup[key].quantity += item.quantity;
                }
            }

            // Filter recipes that user can craft
            const craftableRecipes = recipes.filter(recipe => {
                return recipe.ingredients.every(ingredient => {
                    const hasItem = inventoryLookup[ingredient.item];
                    return hasItem && hasItem.quantity >= ingredient.quantity;
                });
            });

            // Sort recipes by type and name
            const sortedRecipes = craftableRecipes.sort((a, b) => {
                // Sort by type first (buff items first, then sellable)
                if (a.type !== b.type) {
                    return a.type === 'buff' ? -1 : 1;
                }
                // Then by name
                return a.name.localeCompare(b.name);
            });

            if (sortedRecipes.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🍳 Cooking Station')
                    .setDescription('You don\'t have enough ingredients to craft any recipes!\n\n**To cook items, you need:**\n• Fish from fishing\n• Crops from farming\n• Other ingredients from the shop\n\n**Check your inventory with `/inventory`**')
                    .setFooter({ text: 'Use /fish and /farm to gather ingredients' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Create recipe selection menu
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

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                flags: MessageFlags.Ephemeral 
            });

            // Set up collector for recipe selection
            const filter = i => i.user.id === userId && i.customId === 'cook_recipe_select';
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                
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
                const currentInventory = interaction.client.inventory.getUserInventory(userId, guildId);
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
                    const hasItem = currentInventoryLookup[ingredient.item];
                    return hasItem && hasItem.quantity >= ingredient.quantity;
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
                await this.showRecipeDetails(i, selectedRecipe, currentInventoryLookup, interaction.client);
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

        } catch (error) {
            console.error('Error in cook command:', error);
            await interaction.reply({ 
                content: 'There was an error loading the cooking station!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    async showRecipeDetails(interaction, recipe, inventoryLookup, client) {
        const emoji = recipe.emoji || '🍳';
        const type = recipe.type === 'buff' ? '⚡ Buff Item' : '💰 Sellable Item';
        
        // Create ingredients list
        const ingredientsList = recipe.ingredients.map(ingredient => {
            const item = client.inventory.getItem(ingredient.item, interaction.guild.id);
            const userHas = inventoryLookup[ingredient.item];
            const hasEnough = userHas && userHas.quantity >= ingredient.quantity;
            const status = hasEnough ? '✅' : '❌';
            const itemEmoji = item ? client.inventory.getItemEmoji(item) : '❓';
            const itemName = item ? item.name : ingredient.item;
            
            return `${status} ${itemEmoji} **${itemName}** (${ingredient.quantity}x) - You have: ${userHas ? userHas.quantity : 0}`;
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
            await i.deferUpdate();

            if (i.customId === 'cook_back_to_list') {
                // Re-run the original command to show the recipe list
                await this.execute(interaction);
                return;
            }

            if (i.customId === `cook_craft_${recipe.name}`) {
                await this.craftRecipe(i, recipe, interaction.guild.id, client);
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
                const hasItem = currentInventoryLookup[ingredient.item];
                return hasItem && hasItem.quantity >= ingredient.quantity;
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

            const newCookButton = new ButtonBuilder()
                .setCustomId('cook_another')
                .setLabel('🍳 Cook Another')
                .setStyle(ButtonStyle.Success);

            const inventoryButton = new ButtonBuilder()
                .setCustomId('cook_inventory')
                .setLabel('📦 View Inventory')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(newCookButton, inventoryButton);

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Set up collector for post-crafting actions
            const filter = i => i.user.id === interaction.user.id && 
                (i.customId === 'cook_another' || i.customId === 'cook_inventory');
            
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === 'cook_another') {
                    // Re-run the original command to show the recipe list
                    await this.execute(interaction);
                } else if (i.customId === 'cook_inventory') {
                    // Show inventory
                    const inventory = client.inventory.getUserInventory(userId, guildId);
                    const embed = new EmbedBuilder()
                        .setColor(0x2196F3)
                        .setTitle('📦 Your Inventory')
                        .setDescription(inventory.length > 0 ? 
                            inventory.slice(0, 10).map(item => 
                                `${client.inventory.getItemEmoji(item)} **${item.name}** (${item.quantity}x)`
                            ).join('\n') + (inventory.length > 10 ? '\n\n*... and more items*' : '') :
                            'Your inventory is empty!'
                        )
                        .setFooter({ text: `Total items: ${inventory.length}` })
                        .setTimestamp();

                    await i.editReply({
                        embeds: [embed],
                        components: []
                    });
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