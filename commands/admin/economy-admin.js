const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

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
                            { name: 'Role', value: 'role' },
                            { name: 'Custom Role', value: 'custom_role' },
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
                            { name: 'Legendary', value: 'legendary' }
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
                            { name: 'Random Item', value: 'random_item' },
                            { name: 'Role', value: 'role' },
                            { name: 'Custom Role', value: 'custom_role' }
                        ))
                .addIntegerOption(option =>
                    option.setName('effect_value')
                        .setDescription('Effect value (e.g., 2 for 2x multiplier)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Color hex code (for roles)')
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
                .setDescription('Populate the shop with default items')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'add': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            ephemeral: true 
                        });
                    }

                    const newBalance = interaction.client.economy.updateBalance(user.id, guildId, amount, 'balance');
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

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'remove': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount <= 0) {
                        return interaction.reply({ 
                            content: 'Amount must be positive!', 
                            ephemeral: true 
                        });
                    }

                    const currentUser = interaction.client.economy.getUser(user.id, guildId);
                    if (currentUser.balance < amount) {
                        return interaction.reply({ 
                            content: `User only has ${interaction.client.economy.formatCurrency(currentUser.balance)}!`, 
                            ephemeral: true 
                        });
                    }

                    const newBalance = interaction.client.economy.updateBalance(user.id, guildId, -amount, 'balance');
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

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'set': {
                    const user = interaction.options.getUser('user');
                    const amount = interaction.options.getInteger('amount');
                    
                    if (amount < 0) {
                        return interaction.reply({ 
                            content: 'Amount cannot be negative!', 
                            ephemeral: true 
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

                    await interaction.reply({ embeds: [embed] });
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

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'add-item': {
                    const id = interaction.options.getString('id');
                    const name = interaction.options.getString('name');
                    const description = interaction.options.getString('description');
                    const type = interaction.options.getString('type');
                    const rarity = interaction.options.getString('rarity');
                    const price = interaction.options.getInteger('price');
                    const max_quantity = interaction.options.getInteger('max_quantity') || 1;
                    const duration_hours = interaction.options.getInteger('duration_hours') || 0;
                    const effect_type = interaction.options.getString('effect_type');
                    const effect_value = interaction.options.getInteger('effect_value') || 0;
                    const color = interaction.options.getString('color');
                    
                    if (!id || !name || !description || !type || !rarity || !price) {
                        return interaction.reply({ 
                            content: 'Missing required options!', 
                            ephemeral: true 
                        });
                    }

                    // Check if item already exists
                    if (interaction.client.inventory.itemExists(id, guildId)) {
                        return interaction.reply({ 
                            content: `Item with ID "${id}" already exists in this guild!`, 
                            ephemeral: true 
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
                        max_quantity,
                        duration_hours,
                        effect_type,
                        effect_value,
                        color
                    };

                    const success = interaction.client.inventory.addShopItem(itemData);
                    
                    if (!success) {
                        return interaction.reply({ 
                            content: 'Failed to add item to shop!', 
                            ephemeral: true 
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
                            { name: '📦 Max Quantity', value: max_quantity.toString(), inline: true },
                            { name: '⏰ Duration', value: duration_hours > 0 ? `${duration_hours}h` : 'Permanent', inline: true }
                        )
                        .setFooter({ text: `Added by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'remove-item': {
                    const id = interaction.options.getString('id');
                    
                    if (!id) {
                        return interaction.reply({ 
                            content: 'Missing item ID!', 
                            ephemeral: true 
                        });
                    }

                    // Check if item exists
                    if (!interaction.client.inventory.itemExists(id, guildId)) {
                        return interaction.reply({ 
                            content: `Item with ID "${id}" not found in this guild!`, 
                            ephemeral: true 
                        });
                    }

                    const success = interaction.client.inventory.removeShopItem(id, guildId);
                    
                    if (!success) {
                        return interaction.reply({ 
                            content: 'Failed to remove item from shop!', 
                            ephemeral: true 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ Item Removed from Shop')
                        .setDescription(`Successfully removed item **${id}** from the shop`)
                        .setFooter({ text: `Removed by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
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

                        return interaction.reply({ embeds: [embed] });
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

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'populate-defaults': {
                    // Check if items already exist
                    const existingItems = interaction.client.inventory.getShopItems(guildId);
                    if (existingItems.length > 0) {
                        return interaction.reply({ 
                            content: `Shop already has ${existingItems.length} items! Use \`/economy-admin list-items\` to see them.`, 
                            ephemeral: true 
                        });
                    }

                    interaction.client.inventory.populateDefaultItems(guildId);

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Default Items Added')
                        .setDescription('Successfully populated the shop with default items!')
                        .addFields(
                            { name: '📦 Items Added', value: '9 default items', inline: true },
                            { name: '🎯 Types', value: 'Roles, XP Boosts, Work Multipliers, Mystery Boxes', inline: true }
                        )
                        .setFooter({ text: `Populated by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('Error in economy-admin command:', error);
            await interaction.reply({ 
                content: 'There was an error processing the admin command!', 
                ephemeral: true 
            });
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