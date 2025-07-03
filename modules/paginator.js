const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

const paginator = async (interaction, pages) => {

    if (pages.length === 1) {
        return interaction.reply({ embeds: [pages[0]] });
    }

    let page = 0;
    const getButtons = () => new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('leftPaginationButton')
                .setLabel('🡠')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('rightPaginationButton')
                .setLabel('🡢')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === pages.length - 1)
        );

    await interaction.reply({ embeds: [pages[page]], components: [getButtons()]});
    const message = await interaction.fetchReply();
    
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'You cannot use this button.', flags: MessageFlags.Ephemeral });
        }
        
        await i.deferUpdate();

        if (i.customId === 'leftPaginationButton') {
            page = page > 0 ? --page : pages.length - 1;
        } else if (i.customId === 'rightPaginationButton') {
            page = page + 1 < pages.length ? ++page : 0;
        }
        
        await i.editReply({ embeds: [pages[page]], components: [getButtons()] });
    });

    collector.on('end', () => {
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leftPaginationButton')
                    .setLabel('🡠')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('rightPaginationButton')
                    .setLabel('🡢')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        interaction.editReply({ components: [disabledRow] });
    });
};

module.exports = paginator;