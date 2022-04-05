const { MessageButton, MessageActionRow } = require('discord.js');

const paginator = async (msg, pages) => {

    let page = 0;
    const leftButton = new MessageButton().setLabel('🡠').setCustomId('leftPaginationButton').setStyle('SECONDARY');
    const rightButton = new MessageButton().setLabel('🡢').setCustomId('rightPaginationButton').setStyle('SECONDARY');
    const row = new MessageActionRow().addComponents([leftButton, rightButton]);

    msg.reply({ embeds: [pages[page]], components: [row] });
    const filters = (b) => ['leftPaginationButton', 'rightPaginationButton'].includes(b.customId);
    const pageCollector = await msg.channel.createMessageComponentCollector({ filter: filters });

    pageCollector.on('collect', clickedButton => {
        const message = clickedButton.message;

        if(clickedButton.user.id === msg.user.id) {

            if(clickedButton.customId === 'leftPaginationButton') {
                page = page > 0 ? --page : pages.length - 1;
            }
            else if(clickedButton.customId === 'rightPaginationButton') {
                page = page + 1 < pages.length ? ++page : 0;
            }

            message.edit({ embeds: [pages[page]], components: [row] });

            clickedButton.deferUpdate();
        }
    });

    pageCollector.on('end', (collected, reason) => {
        console.log(collected);
        console.log(reason);
        if(!msg.deleted) {

            row.components[0].disabled = true;
            row.components[1].disabled = true;

            // msg.client.channels.cache.get(msg.channel.id).fetch(msgg => msgg.id === msg.id).then(message => message.edit({ embeds: [pages[page]], component: row }));
            // msg.edit({ embeds: [pages[page]], component: row });
        }
    });

    return msg;
};

module.exports = paginator;