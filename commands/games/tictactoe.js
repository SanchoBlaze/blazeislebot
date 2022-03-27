const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');

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

        const row1 = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId('ttt11')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt12')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt13')
                .setLabel('_')
                .setStyle('SECONDARY'),
        );
        const row2 = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId('ttt21')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt22')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt23')
                .setLabel('_')
                .setStyle('SECONDARY'),
        );
        const row3 = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId('ttt31')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt32')
                .setLabel('_')
                .setStyle('SECONDARY'),
            new MessageButton()
                .setCustomId('ttt33')
                .setLabel('_')
                .setStyle('SECONDARY'),
        );


        const gameFilter = (action) => (action.user.id === opponent.id || action.user.id === challenger.id);
        const collector = interaction.channel.createMessageComponentCollector({
            filter: gameFilter,
        });

        const gameData = [
            { member: challenger, playerSymbol: '❌' },
            { member: opponent, playerSymbol: '⭕' },
        ];

        let player = 0;

        const checkThree = (a, b, c) => (a === b) && (b === c) && (a !== '_');

        const horizontalCheck = (msg) => {

            for (let i = 0; i < 3; i++) {
                if(checkThree(msg.components[i].components[0].label, msg.components[i].components[1].label, msg.components[i].components[2].label)) {
                    msg.components[i].components[0].style = 'SUCCESS';
                    msg.components[i].components[1].style = 'SUCCESS';
                    msg.components[i].components[2].style = 'SUCCESS';
                    return true;
                }
            }
            return false;
        };

        const verticalCheck = (msg) => {

            for (let j = 0; j < 3; j++) {
                if(checkThree(msg.components[0].components[j].label, msg.components[1].components[j].label, msg.components[2].components[j].label)) {
                    msg.components[0].components[j].style = 'SUCCESS';
                    msg.components[1].components[j].style = 'SUCCESS';
                    msg.components[2].components[j].style = 'SUCCESS';
                    return true;
                }
            }
            return false;
        };

        const diagonalCheck = (msg) => {

            if(checkThree(msg.components[0].components[0].label, msg.components[1].components[1].label, msg.components[2].components[2].label)) {
                msg.components[0].components[0].style = 'SUCCESS';
                msg.components[1].components[1].style = 'SUCCESS';
                msg.components[2].components[2].style = 'SUCCESS';
                return true;
            }

            if(checkThree(msg.components[0].components[2].label, msg.components[1].components[1].label, msg.components[2].components[0].label)) {
                msg.components[0].components[2].style = 'SUCCESS';
                msg.components[1].components[1].style = 'SUCCESS';
                msg.components[2].components[0].style = 'SUCCESS';
                return true;
            }

            return false;
        };

        const tieCheck = (msg) => {
            let count = 0;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if(msg.components[i].components[j].label !== '_') count++;
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

                const buttonPressed = message.components[i - 1].components[j - 1];

                buttonPressed.label = gameData[player].playerSymbol;
                buttonPressed.style = 'SECONDARY';
                buttonPressed.disabled = true;

                for (const func of checks) {

                    const data = func(message);

                    if(data) {
                        for (let x = 0; x < 3; x++) {
                            for (let y = 0; y < 3; y++) {
                                if(message.components[x].components[y].label === '_') message.components[x].components[y].disabled = true;
                            }
                        }

                        let score = message.client.getScore.get(gameData[player].member.id, message.guild.id);
                        if (!score) {
                            score = { id: `${message.guild.id}-${gameData[player].member.id}`, user: gameData[player].member.id, guild: message.guild.id, points: 0, level: 1 };
                        }
                        score.points += 50;

                        message.client.setScore.run(score);

                        collector.stop(gameData[player].member.username + ' won.');
                        message.edit({ content: `${gameData[player].playerSymbol} - ${gameData[player].member} won!`, components: message.components });
                        buttonClicked.deferUpdate();
                        return;
                    }
                }

                if(tieCheck(message)) {
                    collector.stop('Tie game.');
                    message.edit({ content: 'The game ended, it is Tie!', components: message.components });
                    buttonClicked.deferUpdate();
                    return;
                }

                player = (player + 1) % 2;

                message.edit({ content: `${gameData[player].playerSymbol} - ${gameData[player].member} its your turn!`, components: message.components });

                buttonClicked.deferUpdate();
            }
        });
    }
}
