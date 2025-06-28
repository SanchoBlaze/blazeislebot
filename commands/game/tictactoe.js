const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play tic tac toe.')
        .addUserOption((option) =>
            option.setName('opponent')
                .setDescription('User to challenge.')
                .setRequired(true)),
    execute(interaction) {
        const ttt = new TicTacToe();
        ttt.updateGrid(interaction);

    },
};

class TicTacToe {

    updateGrid(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ttt11')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt12')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt13')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ttt21')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt22')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt23')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
        );
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ttt31')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt32')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ttt33')
                .setLabel('_')
                .setStyle(ButtonStyle.Secondary),
        );


        const gameFilter = (action) => ((action.user.id === opponent.id || action.user.id === challenger.id)) && ['ttt11', 'ttt12', 'ttt13', 'ttt21', 'ttt22', 'ttt23', 'ttt31', 'ttt32', 'ttt33'].includes(action.customId);
        const collector = interaction.channel.createMessageComponentCollector({
            filter: gameFilter,
        });

        const gameData = [
            { member: challenger, playerSymbol: '❌' },
            { member: opponent, playerSymbol: '⭕' },
        ];

        let player = 0;

        const checkThree = (a, b, c) => (a === b) && (b === c) && (a !== '_');

        const horizontalCheck = (rows) => {

            for (let i = 0; i < 3; i++) {
                if(checkThree(rows[i].components[0].data.label, rows[i].components[1].data.label, rows[i].components[2].data.label)) {
                    rows[i].components[0].setStyle(ButtonStyle.Success);
                    rows[i].components[1].setStyle(ButtonStyle.Success);
                    rows[i].components[2].setStyle(ButtonStyle.Success);
                    return true;
                }
            }
            return false;
        };

        const verticalCheck = (rows) => {

            for (let j = 0; j < 3; j++) {
                if(checkThree(rows[0].components[j].data.label, rows[1].components[j].data.label, rows[2].components[j].data.label)) {
                    rows[0].components[j].setStyle(ButtonStyle.Success);
                    rows[1].components[j].setStyle(ButtonStyle.Success);
                    rows[2].components[j].setStyle(ButtonStyle.Success);
                    return true;
                }
            }
            return false;
        };

        const diagonalCheck = (rows) => {

            if(checkThree(rows[0].components[0].data.label, rows[1].components[1].data.label, rows[2].components[2].data.label)) {
                rows[0].components[0].setStyle(ButtonStyle.Success);
                rows[1].components[1].setStyle(ButtonStyle.Success);
                rows[2].components[2].setStyle(ButtonStyle.Success);
                return true;
            }

            if(checkThree(rows[0].components[2].data.label, rows[1].components[1].data.label, rows[2].components[0].data.label)) {
                rows[0].components[2].setStyle(ButtonStyle.Success);
                rows[1].components[1].setStyle(ButtonStyle.Success);
                rows[2].components[0].setStyle(ButtonStyle.Success);
                return true;
            }

            return false;
        };

        const tieCheck = (rows) => {
            let count = 0;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if(rows[i].components[j].data.label !== '_') count++;
                }
            }
            if(count === 9) return true;
            return false;
        };

        const checks = [horizontalCheck, verticalCheck, diagonalCheck];

        interaction.reply({ content: `${interaction.user.username} ❌ challenges ${opponent} ⭕ to Tic Tac Toe!\n❌ ${interaction.user.username} its your turn!`, components: [row1, row2, row3] });


        collector.on('collect', async buttonClicked => {

            if(buttonClicked.user.id === gameData[player].member.id) {

                const message = buttonClicked.message;

                const i = parseInt(buttonClicked.customId[3]),
                    j = parseInt(buttonClicked.customId[4]);

                // Create new button components with updated state
                const newRows = [];
                for (let row = 0; row < 3; row++) {
                    const newRow = new ActionRowBuilder();
                    for (let col = 0; col < 3; col++) {
                        const buttonId = `ttt${row + 1}${col + 1}`;
                        const existingButton = message.components[row].components[col];
                        
                        const newButton = new ButtonBuilder()
                            .setCustomId(buttonId)
                            .setLabel(existingButton.label)
                            .setStyle(existingButton.style)
                            .setDisabled(existingButton.disabled);
                        
                        // Update the clicked button
                        if (row === i - 1 && col === j - 1) {
                            newButton.setLabel(gameData[player].playerSymbol);
                            newButton.setStyle(ButtonStyle.Secondary);
                            newButton.setDisabled(true);
                        }
                        
                        newRow.addComponents(newButton);
                    }
                    newRows.push(newRow);
                }

                for (const func of checks) {

                    const data = func(newRows);

                    if(data) {
                        // Disable all remaining empty buttons
                        for (let x = 0; x < 3; x++) {
                            for (let y = 0; y < 3; y++) {
                                if(newRows[x].components[y].data.label === '_') {
                                    newRows[x].components[y].setDisabled(true);
                                }
                            }
                        }

                        await message.client.loyalty.addXp(50, gameData[player].member, message.guild);

                        collector.stop(gameData[player].member.username + ' won.');
                        message.edit({ content: `${gameData[player].playerSymbol} - ${gameData[player].member} won!`, components: newRows });
                        buttonClicked.deferUpdate();
                        return;
                    }
                }

                if(tieCheck(newRows)) {
                    collector.stop('Tie game.');
                    message.edit({ content: 'The game ended, it is Tie!', components: newRows });
                    buttonClicked.deferUpdate();
                    return;
                }

                player = (player + 1) % 2;

                message.edit({ content: `${gameData[player].playerSymbol} - ${gameData[player].member} its your turn!`, components: newRows });

                buttonClicked.deferUpdate();
            }
        });
    }
}
