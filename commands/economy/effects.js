const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('effects')
        .setDescription('View your active item effects'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const activeEffects = interaction.client.inventory.getActiveEffects(userId, guildId);
            
            if (activeEffects.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🎭 Active Effects')
                    .setDescription('You have no active effects.')
                    .addFields(
                        { name: '💡 How to get effects', value: 'Buy items from the shop with `/shop` and use them with `/use <item>`!', inline: false }
                    )
                    .setFooter({ text: 'Effects provide temporary bonuses to your earnings and activities' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎭 Active Effects')
                .setDescription(`You have **${activeEffects.length}** active effect(s):`)
                .setFooter({ text: 'Effects automatically expire when their time runs out' })
                .setTimestamp();

            for (const effect of activeEffects) {
                const expiresAt = new Date(effect.expires_at);
                const now = new Date();
                const timeLeft = expiresAt - now;
                
                let timeLeftText;
                if (timeLeft <= 0) {
                    timeLeftText = 'Expired';
                } else {
                    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    timeLeftText = `${hours}h ${minutes}m`;
                }

                let effectDescription;
                switch (effect.effect_type) {
                    case 'xp_multiplier':
                        effectDescription = `🎯 **${effect.effect_value}x XP Multiplier**`;
                        break;
                    case 'work_multiplier':
                        effectDescription = `💼 **${effect.effect_value}x Work Multiplier**`;
                        break;
                    case 'daily_multiplier':
                        effectDescription = `📅 **${effect.effect_value}x Daily Multiplier**`;
                        break;
                    case 'coin_multiplier':
                        effectDescription = `💰 **${effect.effect_value}x Coin Multiplier**`;
                        break;
                    default:
                        effectDescription = `❓ **${effect.effect_type}**`;
                }

                embed.addFields({
                    name: effectDescription,
                    value: `⏰ Expires in: ${timeLeftText}`,
                    inline: true
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in effects command:', error);
            await interaction.reply({ 
                content: 'There was an error checking your effects!', 
                ephemeral: true 
            });
        }
    },
}; 