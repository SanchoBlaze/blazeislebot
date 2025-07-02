const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('active-boosts')
        .setDescription('View your currently active boosts.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const inventory = interaction.client.inventory;

        // Get all active effects for the user
        const activeEffects = inventory.getActiveEffects(userId, guildId);

        const embed = new EmbedBuilder()
            .setTitle('⚡ Your Active Boosts')
            .setColor(0xFFD700)
            .setTimestamp();

        if (!activeEffects || activeEffects.length === 0) {
            embed.setDescription('You have no active boosts at the moment. Use the shop to buy and use boosts!');
        } else {
            for (const effect of activeEffects) {
                // Try to get a friendly name and emoji for the effect type
                let effectName = effect.effect_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let emoji = '';
                switch (effect.effect_type) {
                    case 'work_multiplier': emoji = '💼'; break;
                    case 'xp_multiplier': emoji = '⚡'; break;
                    case 'coin_multiplier': emoji = '💰'; break;
                    case 'daily_multiplier': emoji = '📅'; break;
                    case 'fishing_boost': emoji = '🎣'; break;
                    default: emoji = '✨'; break;
                }
                // Calculate time remaining
                let timeLeft = '';
                if (effect.expires_at) {
                    const expires = new Date(effect.expires_at);
                    const now = new Date();
                    const ms = expires - now;
                    if (ms > 0) {
                        const hours = Math.floor(ms / (1000 * 60 * 60));
                        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                        timeLeft = `⏳ ${hours}h ${minutes}m left`;
                    } else {
                        timeLeft = 'Expired';
                    }
                }
                embed.addFields({
                    name: `${emoji} ${effectName}`,
                    value: `**Value:** ${effect.effect_value}x\n${timeLeft}`,
                    inline: false
                });
            }
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
}; 