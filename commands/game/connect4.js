const discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connect4')
        .setDescription('Play Connect4 against the tagged user.')
        .addUserOption((option) =>
            option.setName('opponent')
                .setDescription('User to challenge.')
                .setRequired(true)),
    execute(interaction) {
        const c4 = new ConnectFour();
        c4.startGame(interaction);

    },
};

class ConnectFour {

    constructor() {
        this.gameEmbed = null;
    }

    startGame(msg) {

        const challenger = msg.user;
        const opponent = msg.options.getUser('opponent');
        let embedColour = Colours.BLUE;

        msg.reply(`${msg.user.username} has challenged ${opponent} to Connect4!`);

        const boardLayout = [
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
            ['⚪', '⚪', '⚪', '⚪', '⚪', '⚪', '⚪'],
        ];

        const renderBoard = (board) => {
            let tempString = '';
            for (const boardSection of board) {
                tempString += `${boardSection.join('')}\n`;
            }

            tempString = tempString.concat('1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣');
            return tempString;
        };

        const initialState = renderBoard(boardLayout);

        const initial = new EmbedBuilder()
            .setTitle(`🔴 ${msg.user.username} its your turn!`)
            .setDescription(initialState)
            .setColor(embedColour)
            .setFooter({ text: `${challenger.username} vs ${opponent.username}` });
        msg.channel.send({ embeds : [initial] }).then(gameMessage => {

            gameMessage.react('1️⃣');
            gameMessage.react('2️⃣');
            gameMessage.react('3️⃣');
            gameMessage.react('4️⃣');
            gameMessage.react('5️⃣');
            gameMessage.react('6️⃣');
            gameMessage.react('7️⃣');

            const gameFilter = (reaction, user) => ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'].includes(reaction.emoji.name) && (user.id === opponent.id || user.id === challenger.id);

            const gameCollector = gameMessage.createReactionCollector({ filter: gameFilter });

            const gameData = [
                { member: challenger, playerColor: '🔴' },
                { member: opponent, playerColor: '🟡' },
            ];

            let player = 0;

            const checkFour = (a, b, c, d) => (a === b) && (b === c) && (c === d) && (a !== '⚪');

            const horizontalCheck = () => {

                for (let i = 0; i < 6; i++) {

                    for (let j = 0; j < 4; j++) {
                        if(checkFour(boardLayout[i][j], boardLayout[i][j + 1], boardLayout[i][j + 2], boardLayout[i][j + 3])) {
                            return [
                                boardLayout[i][j], boardLayout[i][j + 1], boardLayout[i][j + 2], boardLayout[i][j + 3],
                            ];
                        }
                    }
                }
            };

            const verticalCheck = () => {
                for (let j = 0; j < 7; j++) {
                    for (let i = 0; i < 3; i++) {

                        if(checkFour(boardLayout[i][j], boardLayout[i + 1][j], boardLayout[i + 2][j], boardLayout[i + 3][j])) {
                            return [
                                boardLayout[i][j], boardLayout[i + 1][j], boardLayout[i + 2][j], boardLayout[i + 3][j],
                            ];
                        }
                    }
                }
            };

            const diagonal1 = () => {
                for (let col = 0; col < 4; col++) {
                    for (let row = 0; row < 3; row++) {
                        if(checkFour(boardLayout[row][col], boardLayout[row + 1][col + 1], boardLayout[row + 2][col + 2], boardLayout[row + 3][col + 3])) {
                            return [
                                boardLayout[row][col], boardLayout[row + 1][col + 1], boardLayout[row + 2][col + 2], boardLayout[row + 3][col + 3],
                            ];
                        }
                    }
                }
            };

            const diagonal2 = () => {
                for (let col = 0; col < 4; col++) {
                    for (let row = 5; row > 2; row--) {
                        if(checkFour(boardLayout[row][col], boardLayout[row - 1][col + 1], boardLayout[row - 2][col + 2], boardLayout[row - 3][col + 3])) {
                            return [
                                boardLayout[row][col], boardLayout[row - 1][col + 1], boardLayout[row - 2][col + 2], boardLayout[row - 3][col + 3],
                            ];
                        }
                    }
                }
            };

            const tieCheck = () => {
                let count = 0;
                for (const el of boardLayout) {
                    for (const string of el) {
                        if(string !== '⚪') count++;
                    }
                }
                if(count === 42) return true;
                else return false;
            };

            const checks = [horizontalCheck, verticalCheck, diagonal1, diagonal2];

            gameCollector.on('collect', (reaction, user) => {

                reaction.message.reactions.cache.get(reaction.emoji.name).users.remove(user.id);

                if(user.id === gameData[player].member.id) {

                    const openSpaces = [];

                    switch (reaction.emoji.name) {
                    case '1️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][0] === '⚪') openSpaces.push({ i, j: 0 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '2️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][1] === '⚪') openSpaces.push({ i, j: 1 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '3️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][2] === '⚪') openSpaces.push({ i, j: 2 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '4️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][3] === '⚪') openSpaces.push({ i, j: 3 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '5️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][4] === '⚪') openSpaces.push({ i, j: 4 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '6️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][5] === '⚪') openSpaces.push({ i, j: 5 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    case '7️⃣':
                        for (let i = 5; i > -1 ; i--) {
                            if(boardLayout[i][6] === '⚪') openSpaces.push({ i, j: 6 });
                        }
                        if(openSpaces.length == 0) return msg.channel.send(`**${gameData[player].member}, that column is already full. Choose another one**`).then(msg1 => msg1.delete({ timeout: 10000 }));
                        else boardLayout[openSpaces[0].i][openSpaces[0].j] = gameData[player].playerColor;
                        break;
                    }

                    if(tieCheck()) {
                        gameMessage.reactions.removeAll();
                        const TieEmbed = new EmbedBuilder()
                            .setTitle('The game ended, it is Tie!')
                            .setDescription(renderBoard(boardLayout))
                            .setColor(embedColour)
                            .setFooter({ text: `${challenger.username} vs ${opponent.username}` });
                        gameCollector.stop('Tie Game');
                        return gameMessage.edit({ embeds : [TieEmbed] });
                    }

                    for (const func of checks) {

                        const data = func();
                        if(data) {
                            gameMessage.reactions.removeAll();

                            if(gameData[player].playerColor === '🔴') {
                                embedColour = Colours.RED;
                            }
                            else {
                                embedColour = Colours.YELLOW;
                            }

                            msg.client.loyalty.addXp(50, gameData[player].member, msg.guild);

                            const WinEmbed = new EmbedBuilder()
                                .setTitle(`${gameData[player].member.username} has won the game!`)
                                .setDescription(renderBoard(boardLayout))
                                .setColor(embedColour)
                                .setFooter({ text: `${challenger.username} vs ${opponent.username}` });
                            gameCollector.stop(`${gameData[player].member.id} won`);
                            return gameMessage.edit({ embeds : [WinEmbed] });
                        }
                    }

                    player = (player + 1) % 2;

                    const newEmbed = new EmbedBuilder()
                        .setTitle(`${gameData[player].playerColor} - ${gameData[player].member.username} its your turn!`)
                        .setDescription(renderBoard(boardLayout))
                        .setColor(embedColour)
                        .setFooter({ text: `${challenger.username} vs ${opponent.username}` });
                    gameMessage.edit({ embeds: [newEmbed] });
                }
            });
        });

    }


}
