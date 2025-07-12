const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy-admin')
        .setDescription('Admin commands for managing the economy')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add coins to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add coins to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove coins from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove coins from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a user\'s balance')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set balance for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('New balance amount')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show economy statistics for the server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-item')
                .setDescription('Add a new item to the shop')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('Unique item ID (e.g., custom_role_1)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Item name')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Item description')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Item type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Consumable', value: 'consumable' },
                            { name: 'Mystery', value: 'mystery' }
                        ))
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Item rarity')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Common', value: 'common' },
                            { name: 'Uncommon', value: 'uncommon' },
                            { name: 'Rare', value: 'rare' },
                            { name: 'Epic', value: 'epic' },
                            { name: 'Legendary', value: 'legendary' },
                            { name: 'Mythic', value: 'mythic' }
                        ))
                .addIntegerOption(option =>
                    option.setName('price')
                        .setDescription('Item price in coins')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('max_quantity')
                        .setDescription('Maximum quantity a user can own')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('duration_hours')
                        .setDescription('Duration in hours (0 for permanent)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('effect_type')
                        .setDescription('Effect type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'XP Multiplier', value: 'xp_multiplier' },
                            { name: 'Work Multiplier', value: 'work_multiplier' },
                            { name: 'Daily Multiplier', value: 'daily_multiplier' },
                            { name: 'Coin Multiplier', value: 'coin_multiplier' },
                            { name: 'Random Item', value: 'random_item' },
                            { name: 'Premium Random Item', value: 'premium_random_item' }
                        ))
                .addIntegerOption(option =>
                    option.setName('effect_value')
                        .setDescription('Effect value (e.g., 2 for 2x multiplier)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-item')
                .setDescription('Remove an item from the shop')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('Item ID to remove')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-items')
                .setDescription('List all items in the shop'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('populate-defaults')
                .setDescription('Populate the shop with default items'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-user-item')
                .setDescription('Add an item to a user\'s inventory')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to give the item to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('item_id')
                        .setDescription('Item ID to give')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('quantity')
                        .setDescription('Quantity to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update-defaults')
                .setDescription('Overwrite the shop with the current default items')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ You need Administrator permissions to use this command!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            switch (subcommand) {
                case 'add': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const newBalance = await interaction.client.economy.updateBalance(user.id, guildId, amount, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_add', amount, `Admin addition by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Coins Added')
                        .setDescription(`Added **${interaction.client.economy.formatCurrency(amount)}** to ${user}`)
                        .addFields(
                            { name: '💰 Amount Added', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp();

                    // DM the user to notify them of the addition
                    try {
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0x00FF00)
                                    .setTitle('💸 You received coins!')
                                    .setDescription(`An admin has added **${interaction.client.economy.formatCurrency(amount)}** to your account in **${interaction.guild.name}**.`)
                                    .addFields(
                                        { name: '💰 Amount Added', value: interaction.client.economy.formatCurrency(amount), inline: true },
                                        { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true }
                                    )
                                    .setFooter({ text: `Added by ${interaction.user.tag}` })
                                    .setTimestamp()
                            ]
                        });
                    } catch (err) {
                        // Ignore DM errors (user may have DMs closed)
                    }

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'remove': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const currentUser = interaction.client.economy.getUser(user.id, guildId);
                    if (currentUser.balance < amount) {
                        return interaction.reply({ 
                            content: `User only has ${interaction.client.economy.formatCurrency(currentUser.balance)}!`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const newBalance = await interaction.client.economy.updateBalance(user.id, guildId, -amount, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_remove', -amount, `Admin removal by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ Coins Removed')
                        .setDescription(`Removed **${interaction.client.economy.formatCurrency(amount)}** from ${user}`)
                        .addFields(
                            { name: '💰 Amount Removed', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '💵 New Balance', value: interaction.client.economy.formatCurrency(newBalance), inline: true }
                        )
                        .setFooter({ text: `Removed by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'set': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount < 0) {
                        return interaction.reply({ 
                            content: 'Amount cannot be negative!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const currentUser = interaction.client.economy.getUser(user.id, guildId);
                    const difference = amount - currentUser.balance;
                    
                    interaction.client.economy.updateBalance(user.id, guildId, difference, 'balance');
                    interaction.client.economy.logTransaction(user.id, guildId, 'admin_set', difference, `Admin balance set by ${interaction.user.tag}`);

                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('⚙️ Balance Set')
                        .setDescription(`Set ${user}'s balance to **${interaction.client.economy.formatCurrency(amount)}**`)
                        .addFields(
                            { name: '💰 New Balance', value: interaction.client.economy.formatCurrency(amount), inline: true },
                            { name: '📊 Change', value: difference >= 0 ? `+${difference}` : difference.toString(), inline: true }
                        )
                        .setFooter({ text: `Set by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'stats': {
                    const stats = interaction.client.economy.getStats(guildId);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('📊 Economy Statistics')
                        .addFields(
                            { name: '👥 Total Users', value: stats.total_users.toString(), inline: true },
                            { name: '💵 Total Wallet Balance', value: interaction.client.economy.formatCurrency(stats.total_balance), inline: true },
                            { name: '🏦 Total Bank Balance', value: interaction.client.economy.formatCurrency(stats.total_bank), inline: true },
                            { name: '📈 Total Earned', value: interaction.client.economy.formatCurrency(stats.total_earned), inline: true },
                            { name: '📉 Total Spent', value: interaction.client.economy.formatCurrency(stats.total_spent), inline: true },
                            { name: '📊 Average Balance', value: interaction.client.economy.formatCurrency(stats.avg_balance), inline: true }
                        )
                        .setFooter({ text: `Server: ${interaction.guild.name}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'add-item': {
                    const id = interaction.options.getString('id');
                    const name = interaction.options.getString('name');
                    const description = interaction.options.getString('description');
                    const type = interaction.options.getString('type');
                    const rarity = interaction.options.getString('rarity');
                    const price = interaction.options.getInteger('price');
                    const maxQuantity = interaction.options.getInteger('max_quantity') || 1;
                    const durationHours = interaction.options.getInteger('duration_hours') || 0;
                    const effectType = interaction.options.getString('effect_type');
                    const effectValue = interaction.options.getInteger('effect_value') || 1;

                    // Validate required fields based on type
                    if (type === 'consumable' && (!effectType || !durationHours)) {
                        return interaction.reply({
                            content: '❌ Consumable items require effect_type and duration_hours.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (type === 'mystery' && effectType !== 'random_item' && effectType !== 'premium_random_item') {
                        return interaction.reply({
                            content: '❌ Mystery items must have effect_type of "random_item" or "premium_random_item".',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Check if item already exists
                    if (interaction.client.inventory.itemExists(id, guildId)) {
                        return interaction.reply({ 
                            content: `Item with ID "${id}" already exists in this guild!`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const itemData = {
                        id,
                        guild: guildId,
                        name,
                        description,
                        type,
                        rarity,
                        price,
                        max_quantity: maxQuantity,
                        duration_hours: durationHours,
                        effect_type: effectType,
                        effect_value: effectValue
                    };

                    const success = interaction.client.inventory.addShopItem(itemData);
                    
                    if (!success) {
                        return interaction.reply({ 
                            content: 'Failed to add item to shop!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Item Added to Shop')
                        .setDescription(`Successfully added **${name}** to the shop`)
                        .addFields(
                            { name: '🆔 Item ID', value: id, inline: true },
                            { name: '💰 Price', value: interaction.client.economy.formatCurrency(price), inline: true },
                            { name: '🏷️ Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
                            { name: '⭐ Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
                            { name: '📦 Max Quantity', value: maxQuantity.toString(), inline: true },
                            { name: '⏰ Duration', value: durationHours > 0 ? `${durationHours}h` : 'Permanent', inline: true }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'remove-item': {
                    const id = interaction.options.getString('id');
                    
                    if (!id) {
                        return interaction.reply({ 
                            content: 'Missing item ID!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    // Check if item exists
                    if (!interaction.client.inventory.itemExists(id, guildId)) {
                        return interaction.reply({ 
                            content: `Item with ID "${id}" not found in this guild!`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const success = interaction.client.inventory.removeShopItem(id, guildId);
                    
                    if (!success) {
                        return interaction.reply({ 
                            content: 'Failed to remove item from shop!', 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ Item Removed from Shop')
                        .setDescription(`Successfully removed item **${id}** from the shop`)
                        .setFooter({ text: `Removed by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'list-items': {
                    const items = interaction.client.inventory.getShopItems(guildId);
                    
                    if (items.length === 0) {
                        const embed = new EmbedBuilder()
                            .setColor(0xFF6B6B)
                            .setTitle('📋 Shop Items')
                            .setDescription('No items found in the shop')
                            .setFooter({ text: `Server: ${interaction.guild.name}` })
                            .setTimestamp();

                        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }

                    // Group items by rarity
                    const itemsByRarity = {};
                    for (const item of items) {
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
                                description += `• **${item.name}** (${item.id}) - ${interaction.client.economy.formatCurrency(item.price)}\n`;
                            }
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('📋 Shop Items')
                        .setDescription(description)
                        .addFields(
                            { name: '📊 Total Items', value: items.length.toString(), inline: true },
                            { name: '💰 Total Value', value: interaction.client.economy.formatCurrency(items.reduce((sum, item) => sum + item.price, 0)), inline: true }
                        )
                        .setFooter({ text: `Server: ${interaction.guild.name}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'populate-defaults': {
                    // Check if items already exist
                    const existingItems = interaction.client.inventory.getShopItems(guildId);
                    if (existingItems.length > 0) {
                        return interaction.reply({ 
                            content: `Shop already has ${existingItems.length} items! Use \`/economy-admin list-items\` to see them.`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }

                    interaction.client.inventory.populateDefaultItemsComplete(guildId);

                    // Dynamically get the number of default items
                    const defaultItems = require('../../data/default-items.json');
                    const defaultItemCount = defaultItems.length;

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Default Items Added')
                        .setDescription('Successfully populated the shop with complete default items (including variants)!')
                        .addFields(
                            { name: '📦 Items Added', value: `${defaultItemCount} default items`, inline: true },
                            { name: '🎯 Types', value: 'XP Boosts, Work Multipliers, Mystery Boxes, Coin Multipliers, Crops with Variants', inline: true }
                        )
                        .setFooter({ text: `Populated by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'update-defaults': {
                    // Load default item IDs
                    const defaultItems = require('../../data/default-items.json');
                    const defaultItemIds = defaultItems.map(item => item.id);
                    // Delete only default items for this guild
                    const deleted = interaction.client.inventory.deleteDefaultItemsForGuild(guildId, defaultItemIds);
                    // Repopulate defaults
                    interaction.client.inventory.populateDefaultItems(guildId);

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Defaults Updated')
                        .setDescription('The default items in the shop have been updated! Custom items were preserved.')
                        .addFields(
                            { name: '🗑️ Defaults Deleted', value: deleted.toString(), inline: true },
                            { name: '📦 Defaults Added', value: defaultItemIds.length.toString(), inline: true }
                        )
                        .setFooter({ text: `Updated by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }

                case 'add-user-item': {
                    const user = interaction.options.getUser('user');
                    const itemId = interaction.options.getString('item_id');
                    const quantity = interaction.options.getInteger('quantity');

                    if (quantity <= 0) {
                        return interaction.reply({
                            content: 'Quantity must be positive!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const item = interaction.client.inventory.getItem(itemId, guildId);
                    if (!item) {
                        return interaction.reply({
                            content: `Item with ID "${itemId}" not found in the shop!`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const success = interaction.client.inventory.addItem(user.id, guildId, itemId, quantity, interaction, interaction.client);
                    if (!success) {
                        return interaction.reply({
                            content: 'Failed to add item to user inventory!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // DM the user to notify them of the item addition
                    try {
                        const emoji = interaction.client.inventory.getItemEmoji(item);
                        const emojiUrl = interaction.client.inventory.getEmojiUrl(emoji, interaction.client);
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(interaction.client.inventory.getRarityColour(item.rarity))
                                    .setTitle('🎁 You received an item!')
                                    .setDescription(`An admin has given you **${quantity}x ${emoji} ${item.name}** in **${interaction.guild.name}**.`)
                                    .setThumbnail(emojiUrl)
                                    .addFields(
                                        { name: '📦 Item', value: `${emoji} ${item.name}`, inline: true },
                                        { name: '📊 Quantity', value: quantity.toString(), inline: true },
                                        { name: '⭐ Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true },
                                        { name: '📝 Description', value: item.description, inline: false }
                                    )
                                    .setFooter({ text: `Given by ${interaction.user.tag}` })
                                    .setTimestamp()
                            ]
                        });
                    } catch (err) {
                        // Ignore DM errors (user may have DMs closed)
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Item Added to User')
                        .setDescription(`Added **${quantity}x ${item.name}** to ${user}`)
                        .addFields(
                            { name: '🆔 Item ID', value: itemId, inline: true },
                            { name: '👤 User', value: user.toString(), inline: true },
                            { name: '📦 Quantity', value: quantity.toString(), inline: true }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp();

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error in economy-admin command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'There was an error processing the admin command!', 
                    flags: MessageFlags.Ephemeral 
                });
            } else {
                await interaction.reply({ 
                    content: 'There was an error processing the admin command!', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'remove-item') {
            try {
                const items = interaction.client.inventory.getShopItems(guildId);
                const choices = items.map(item => ({
                    name: `${item.name} (${item.id})`,
                    value: item.id
                }));

                const filtered = choices.filter(choice => 
                    choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
                    choice.value.toLowerCase().includes(focusedValue.toLowerCase())
                ).slice(0, 25);

                await interaction.respond(filtered);
            } catch (error) {
                console.error('Error in economy-admin autocomplete:', error);
                await interaction.respond([]);
            }
        }
    },
}; 