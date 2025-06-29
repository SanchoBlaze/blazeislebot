const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy-help')
        .setDescription('Learn about the economy system and commands'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('💰 Economy System Help')
            .setDescription('Welcome to the economy system! Here are all the available commands:')
            .addFields(
                {
                    name: '💵 Basic Commands',
                    value: '• `/balance [user]` - Check your or another user\'s balance\n• `/daily` - Claim your daily reward (100 coins)\n• `/work` - Work to earn coins (10-50 coins, 1 hour cooldown)',
                    inline: false
                },
                {
                    name: '🏦 Banking Commands',
                    value: '• `/deposit <amount>` - Deposit coins to your bank\n• `/withdraw <amount>` - Withdraw coins from your bank',
                    inline: false
                },
                {
                    name: '💸 Transfer Commands',
                    value: '• `/transfer <user> <amount>` - Send coins to another user',
                    inline: false
                },
                {
                    name: '📊 Information Commands',
                    value: '• `/economy-leaderboard [limit]` - Show richest users\n• `/history [user] [limit]` - Show transaction history\n• `/shop` - View the economy shop',
                    inline: false
                },
                {
                    name: '⚙️ Admin Commands',
                    value: '• `/economy-admin add <user> <amount>` - Add coins to user\n• `/economy-admin remove <user> <amount>` - Remove coins from user\n• `/economy-admin set <user> <amount>` - Set user\'s balance\n• `/economy-admin stats` - Show economy statistics',
                    inline: false
                }
            )
            .addFields(
                {
                    name: '🎯 How to Earn Coins',
                    value: '• **Daily Reward**: `/daily` - Get 100 coins every 24 hours\n• **Work**: `/work` - Earn 10-50 coins every hour\n• **Chat Activity**: Earn 1 coin per message (automatic)\n• **Admin Rewards**: Server admins can give you coins',
                    inline: false
                },
                {
                    name: '💡 Tips',
                    value: '• Use `/daily` every day to maximize earnings\n• Work regularly with `/work` for steady income\n• Keep some coins in the bank for safety\n• Check `/economy-leaderboard` to see how you rank\n• Use `/shop` to spend your coins on rewards',
                    inline: false
                }
            )
            .setFooter({ text: 'Economy system by Blaze Isle Bot' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
}; 