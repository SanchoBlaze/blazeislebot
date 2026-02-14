const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// Category definitions for economy help
const categories = [
  {
    id: 'basic',
    emoji: '💵',
    name: 'Basic',
    fields: [
      { name: '/balance', value: 'Check your wallet and bank balance', inline: true },
      { name: '/daily', value: 'Collect your daily reward', inline: true },
      { name: '/work', value: 'Work to earn coins', inline: true },
      { name: '/fish', value: 'Go fishing to catch fish', inline: true },
    ],
    description: 'Basic commands for earning and checking coins.'
  },
  {
    id: 'bank',
    emoji: '🏦',
    name: 'Banking',
    fields: [
      { name: '/deposit', value: 'Move coins from wallet to bank', inline: true },
      { name: '/withdraw', value: 'Move coins from bank to wallet', inline: true },
    ],
    description: 'Deposit and withdraw coins from your bank.'
  },
  {
    id: 'transfer',
    emoji: '💸',
    name: 'Transfer',
    fields: [
      { name: '/transfer', value: 'Send coins to another user', inline: true },
    ],
    description: 'Send coins to other users.'
  },
  {
    id: 'inventory',
    emoji: '📦',
    name: 'Inventory',
    fields: [
      { name: '/inventory', value: 'View your inventory', inline: true },
      { name: '/use', value: 'Use items from your inventory', inline: true },
      { name: '/effects', value: 'View your active effects', inline: true },
      { name: '/shop', value: 'Browse and buy items', inline: true },
      { name: '/sell', value: 'Sell items back to the shop (interactive menu)', inline: true },
    ],
    description: 'Manage and use your items.'
  },
  {
    id: 'info',
    emoji: '📊',
    name: 'Information',
    fields: [
      { name: '/leaderboard', value: 'View the richest users', inline: true },
      { name: '/history', value: 'View your transaction history', inline: true },
      { name: '/help-economy', value: 'Get help with economy commands', inline: true },
    ],
    description: 'Get stats and information about the economy.'
  },
  {
    id: 'admin',
    emoji: '⚙️',
    name: 'Admin',
    fields: [
      { name: '/economy-admin add', value: 'Add coins to user', inline: false },
      { name: '/economy-admin remove', value: 'Remove coins from user', inline: false },
      { name: '/economy-admin set', value: 'Set user\'s balance', inline: false },
      { name: '/economy-admin stats', value: 'Show economy statistics', inline: false },
      { name: '/economy-admin add-item', value: 'Add new item to shop', inline: false },
      { name: '/economy-admin remove-item', value: 'Remove item from shop', inline: false },
      { name: '/economy-admin list-items', value: 'List all shop items', inline: false },
      { name: '/economy-admin populate-defaults', value: 'Add default items to shop (new guilds)', inline: false },
      { name: '/economy-admin update-defaults', value: 'Refresh default items from data', inline: false },
    ],
    description: 'Admin-only commands for managing the economy.'
  },
  {
    id: 'tips',
    emoji: '💡',
    name: 'Tips',
    fields: [
      { name: 'Tips', value: '• Use `/daily` every day to maximize earnings\n• Work regularly with `/work` for steady income\n• Fish regularly with `/fish` for additional income\n• Keep some coins in the bank for safety\n• Check `/leaderboard` to see how you rank\n• Use items strategically to boost your earnings\n• **Note**: Only one effect of each type can be active at a time - wait for effects to expire before using new ones', inline: false },
    ],
    description: 'Tips for maximizing your economy experience.'
  },
  {
    id: 'shop',
    emoji: '🛒',
    name: 'Shop & Items',
    fields: [
      { name: 'Shop & Items', value: '• **Shop**: `/shop` - View items with pagination and dropdown purchase\n• **Inventory**: `/inventory` - View your items\n• **Use Items**: `/use <item>` - Activate item effects\n• **Item Types**: Roles, XP boosts, work multipliers, mystery boxes, fish, fishing rods\n• **Fish Items**: Server admins can add custom fish using `/economy-admin add-item`\n• **Fishing Rods**: Improve rare fish catch rates (permanent items)', inline: false },
    ],
    description: 'Shop, inventory, and item system overview.'
  },
  {
    id: 'earn',
    emoji: '🎯',
    name: 'How to Earn Coins',
    fields: [
      { name: 'How to Earn Coins', value: '• **Daily Reward**: `/daily` - Get 100 coins every 24 hours\n• **Work**: `/work` - Earn 10-50 coins every hour\n• **Fishing**: `/fish` - Catch fish to sell (prices vary by rarity)\n• **Level Up**: Earn coins when you level up (50-750 coins based on level)\n• **Chat Activity**: Earn 1 coin per message (automatic)\n• **Admin Rewards**: Server admins can give you coins', inline: false },
    ],
    description: 'All the ways you can earn coins.'
  },
];

function getHomeEmbed(user) {
  return new EmbedBuilder()
    .setTitle('💰 Economy Help Menu')
    .setDescription('Select a category from the dropdown below to view its commands and tips.')
    .setColor(0x00FF00)
    .addFields(categories.map(cat => ({
      name: `${cat.emoji} ${cat.name}`,
      value: cat.description,
      inline: false,
    })))
    .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();
}

function getCategorySelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('economy-help-category-select')
      .setPlaceholder('Choose a category...')
      .addOptions(
        categories.map(cat => ({
          label: cat.name,
          value: cat.id,
          emoji: cat.emoji,
        }))
      )
  );
}

function getHomeButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('economy-help-home-button')
      .setLabel('Back to Home')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏠')
  );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help-economy')
        .setDescription('Learn about the economy system and commands'),

    async execute(interaction) {
        const user = interaction.user;
        await interaction.reply({
          embeds: [getHomeEmbed(user)],
          components: [getCategorySelectMenu()],
          flags: MessageFlags.Ephemeral
        });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
          time: 120000, // 2 minutes
        });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) {
            return i.reply({ content: 'You cannot use this menu.', flags: MessageFlags.Ephemeral });
          }
          await i.deferUpdate();

          if (i.isStringSelectMenu()) {
            const catId = i.values[0];
            const cat = categories.find(c => c.id === catId);
            if (!cat) return;
            const embed = new EmbedBuilder()
              .setTitle(`${cat.emoji} ${cat.name} Commands`)
              .setColor(0x00FF00)
              .setDescription(cat.description)
              .addFields(cat.fields)
              .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
              .setTimestamp();
            await i.editReply({ embeds: [embed], components: [getHomeButton()], flags: MessageFlags.Ephemeral });
          }
          if (i.isButton()) {
            if (i.customId === 'economy-help-home-button') {
              await i.editReply({ embeds: [getHomeEmbed(user)], components: [getCategorySelectMenu()], flags: MessageFlags.Ephemeral });
            }
          }
        });

        collector.on('end', () => {
          const disabledSelect = getCategorySelectMenu();
          disabledSelect.components[0].setDisabled(true);
          interaction.editReply({ components: [disabledSelect], flags: MessageFlags.Ephemeral }).catch(() => {});
        });
    },
}; 