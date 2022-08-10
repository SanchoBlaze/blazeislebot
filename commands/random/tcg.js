const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tcg')
        .setDescription('Calculate the page and slot for any number in a 3x3 two sided trading card pocket.')
        .addIntegerOption((option) =>
            option.setName('number')
                .setDescription('Number to calculate slot and page for.')
                .setRequired(true)),
    guildOnly: false,
    execute(interaction) {
        const number = interaction.options.getInteger('number');

        let page = 1;
        let side = 1;
        let pocket = 1;
        let count = 1;

        for (let i = 1; i < number; i++) {

            if(pocket > 9) pocket = 1;
            if(count > 9) side = 2;


            if(count > 18) {
                page++;
                side = 1;
                count = 1;
            }

            if(i < number - 1) {
                pocket++;
                count++;
            }

            console.log(`Page: ${page}, Side: ${side}, Pocket: ${pocket}, number ${i}\n`);
        }

        return interaction.reply(`Card ${number} goes in Page: ${page}, Side: ${side}, Pocket: ${pocket}`);
    },
};