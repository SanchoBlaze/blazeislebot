const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// Board: 24 positions from SVG (board coords 0-240). PNG is 300x300 with offset (30.5, 30.5).
const BOARD_POSITIONS = [
    [0, 0], [120, 0], [240, 0], [40, 40], [120, 40], [200, 40],
    [80, 80], [120, 80], [160, 80], [0, 120], [40, 120], [80, 120],
    [160, 120], [200, 120], [240, 120], [80, 160], [120, 160], [160, 160],
    [40, 200], [120, 200], [200, 200], [0, 240], [120, 240], [240, 240]
];

// Adjacency: indices of connected points (from board lines)
const ADJACENCY = [
    [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13],
    [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15],
    [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16],
    [10, 19, 21], [16, 18, 20, 22], [13, 19, 23], [9, 18, 22], [19, 21, 23], [14, 20, 22]
];

// Mill lines: triplets of indices that form a line of 3
const MILL_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
    [0, 9, 21], [1, 4, 7], [2, 14, 23], [3, 10, 18], [5, 13, 20], [6, 11, 15], [8, 12, 17], [16, 19, 22]
];

const EMPTY = 0;
const P1 = 1;
const P2 = 2;

const BOARD_IMG_OFFSET_X = 30.5;
const BOARD_IMG_OFFSET_Y = 30.5;
const PIECE_RADIUS = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ninemensmorris')
        .setDescription('Play Nine Men\'s Morris against another user.')
        .addUserOption((option) =>
            option.setName('opponent')
                .setDescription('User to challenge.')
                .setRequired(true)),
    execute(interaction) {
        const game = new NineMensMorris();
        game.startGame(interaction);
    },
};

function checkMillForPosition(board, position, player) {
    return MILL_LINES.some(line => {
        if (!line.includes(position)) return false;
        return line.every(i => board[i] === player);
    });
}

function getRemovableOpponentPieces(board, opponent) {
    const opp = opponent === P1 ? P1 : P2;
    const inMill = (idx) => checkMillForPosition(board, idx, opp);
    const pieces = board.map((v, i) => v === opp ? i : -1).filter(i => i >= 0);
    const notInMill = pieces.filter(i => !inMill(i));
    if (notInMill.length > 0) return notInMill;
    return pieces;
}

function getValidMoves(board, fromIndex, isFlying) {
    if (board[fromIndex] === EMPTY) return [];
    if (isFlying) {
        return board.map((v, i) => (v === EMPTY ? i : -1)).filter(i => i >= 0);
    }
    return ADJACENCY[fromIndex].filter(i => board[i] === EMPTY);
}

function hasLegalMove(board, player, isFlying) {
    const pieces = board.map((v, i) => v === player ? i : -1).filter(i => i >= 0);
    if (pieces.length < 3) return false;
    if (isFlying) return board.some(cell => cell === EMPTY);
    return pieces.some(from => getValidMoves(board, from, false).length > 0);
}

function countPieces(board, player) {
    return board.filter(c => c === player).length;
}

async function renderBoardImage(board) {
    const basePath = path.join(__dirname, '../../assets/nine_mens_morris_board.png');
    const baseImage = await loadImage(basePath);
    const w = baseImage.width;
    const h = baseImage.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImage, 0, 0);

    const scaleX = w / 300;
    const scaleY = h / 300;
    const r = PIECE_RADIUS * Math.min(scaleX, scaleY);

    // Draw position numbers at each intersection (readable: larger, bold, with white outline)
    const fontSize = Math.round(16 * Math.min(scaleX, scaleY));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 24; i++) {
        const [bx, by] = BOARD_POSITIONS[i];
        const px = BOARD_IMG_OFFSET_X * scaleX + bx * scaleX;
        const py = BOARD_IMG_OFFSET_Y * scaleY + by * scaleY;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeText(String(i), px, py);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(String(i), px, py);
    }

    for (let i = 0; i < 24; i++) {
        if (board[i] === EMPTY) continue;
        const [bx, by] = BOARD_POSITIONS[i];
        const px = BOARD_IMG_OFFSET_X * scaleX + bx * scaleX;
        const py = BOARD_IMG_OFFSET_Y * scaleY + by * scaleY;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.fillStyle = board[i] === P1 ? '#ffffff' : '#000000';
        ctx.fill();
        ctx.stroke();
    }

    return canvas.toBuffer('image/png');
}

function buildButtonRows(board, state) {
    const { phase, currentPlayer, selectedPiece, mustRemove } = state;
    const isFlying = phase === 'movement' && countPieces(board, currentPlayer) === 3;

    let enabledSet = new Set();
    if (mustRemove) {
        const opponent = currentPlayer === P1 ? P2 : P1;
        getRemovableOpponentPieces(board, opponent).forEach(i => enabledSet.add(i));
    } else if (phase === 'placement') {
        board.forEach((c, i) => { if (c === EMPTY) enabledSet.add(i); });
    } else if (selectedPiece !== null) {
        getValidMoves(board, selectedPiece, isFlying).forEach(i => enabledSet.add(i));
    } else {
        const pieces = board.map((v, i) => v === currentPlayer ? i : -1).filter(i => i >= 0);
        pieces.forEach(from => {
            getValidMoves(board, from, isFlying).forEach(to => enabledSet.add(from));
        });
    }

    const label = (i) => {
        const num = String(i);
        if (board[i] === P1) return `${num} ⚪`;
        if (board[i] === P2) return `${num} ⚫`;
        return num;
    };

    const rows = [];
    const ids = Array.from({ length: 24 }, (_, i) => i);
    for (let r = 0; r < 5; r++) {
        const start = r * 5;
        const end = r === 4 ? 24 : start + 5;
        const row = new ActionRowBuilder();
        for (let i = start; i < end; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`nmm_${i}`)
                    .setLabel(label(i))
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!enabledSet.has(i))
            );
        }
        rows.push(row);
    }
    return rows;
}

function getStatusContent(state, challenger, opponent) {
    const { phase, currentPlayer, mustRemove } = state;
    const currentUser = currentPlayer === P1 ? challenger : opponent;
    const name = currentUser.displayName || currentUser.username;
    if (mustRemove) {
        return `**${name}** formed a mill! Remove an opponent piece.`;
    }
    if (phase === 'placement') {
        return `**${name}** – place a piece.`;
    }
    return `**${name}** – select piece to move, then destination.`;
}

/** Returns turn message with @ mention so the user gets notified (for message content). */
function getTurnContentWithMention(state, challenger, opponent) {
    const { phase, currentPlayer, mustRemove } = state;
    const currentUser = currentPlayer === P1 ? challenger : opponent;
    if (mustRemove) {
        return `${currentUser} formed a mill! Remove an opponent piece.`;
    }
    if (phase === 'placement') {
        return `${currentUser} – place a piece.`;
    }
    return `${currentUser} – select piece to move, then destination.`;
}

function getPlayerLine(challenger, opponent) {
    return `⚪ ${challenger} | ⚫ ${opponent}`;
}

class NineMensMorris {
    constructor() {
        this.board = Array(24).fill(EMPTY);
        this.piecesToPlace = [9, 9];
        this.phase = 'placement';
        this.currentPlayer = P1;
        this.selectedPiece = null;
        this.mustRemove = false;
    }

    async startGame(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        if (opponent.id === challenger.id) {
            return interaction.reply({ content: 'You cannot challenge yourself.', flags: MessageFlags.Ephemeral });
        }
        if (opponent.bot) {
            return interaction.reply({ content: 'You cannot challenge a bot.', flags: MessageFlags.Ephemeral });
        }

        const gameData = [
            { member: challenger, player: P1 },
            { member: opponent, player: P2 },
        ];
        const guild = interaction.guild;

        const state = () => ({
            phase: this.phase,
            currentPlayer: this.currentPlayer,
            selectedPiece: this.selectedPiece,
            mustRemove: this.mustRemove,
        });

        const buffer = await renderBoardImage(this.board);
        const attachment = new AttachmentBuilder(buffer, { name: 'morris_board.png' });
        const embed = new EmbedBuilder()
            .setTitle('Nine Men\'s Morris')
            .setDescription(getPlayerLine(challenger, opponent))
            .setImage('attachment://morris_board.png')
            .addFields({ name: 'Turn', value: getTurnContentWithMention(state(), challenger, opponent) })
            .setColor(0x8B4513);

        const components = buildButtonRows(this.board, state());
        await interaction.reply({
            content: `${challenger} challenges ${opponent} to Nine Men's Morris!`,
            embeds: [embed],
            files: [attachment],
            components,
        });

        const filter = (i) => {
            if (!i.customId.startsWith('nmm_')) return false;
            if (i.user.id !== challenger.id && i.user.id !== opponent.id) return false;
            return true;
        };
        const collector = interaction.channel.createMessageComponentCollector({ filter });

        collector.on('collect', async (button) => {
            const playerData = gameData.find(g => g.member.id === button.user.id);
            if (!playerData || playerData.player !== this.currentPlayer) {
                await button.reply({ content: "It's not your turn.", flags: MessageFlags.Ephemeral }).catch(() => button.deferUpdate());
                return;
            }

            const idx = parseInt(button.customId.replace('nmm_', ''), 10);
            if (idx < 0 || idx > 23) {
                await button.deferUpdate();
                return;
            }

            if (this.mustRemove) {
                const opponentPlayer = this.currentPlayer === P1 ? P2 : P1;
                const removable = getRemovableOpponentPieces(this.board, opponentPlayer);
                if (!removable.includes(idx)) {
                    await button.deferUpdate();
                    return;
                }
                this.board[idx] = EMPTY;
                this.mustRemove = false;
                if (countPieces(this.board, opponentPlayer) < 3) {
                    collector.stop('win');
                    const winner = gameData.find(g => g.player === this.currentPlayer).member;
                    if (guild && button.client.loyalty) {
                        await button.client.loyalty.addXp(50, winner, guild);
                    }
                    const winBuffer = await renderBoardImage(this.board);
                    const winAttach = new AttachmentBuilder(winBuffer, { name: 'morris_board.png' });
                    const winEmbed = new EmbedBuilder()
                        .setTitle('Nine Men\'s Morris')
                        .setDescription(getPlayerLine(challenger, opponent))
                        .setImage('attachment://morris_board.png')
                        .addFields({ name: 'Result', value: `${winner} wins!` })
                        .setColor(0x8B4513);
                    const disabledRows = buildButtonRows(this.board, state()).map(row => {
                        row.components.forEach(c => c.setDisabled(true));
                        return row;
                    });
                    await button.message.edit({
                        embeds: [winEmbed],
                        files: [winAttach],
                        components: disabledRows,
                    });
                    await button.deferUpdate();
                    return;
                }
                this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
            } else if (this.phase === 'placement') {
                if (this.board[idx] !== EMPTY) {
                    await button.deferUpdate();
                    return;
                }
                this.board[idx] = this.currentPlayer;
                this.piecesToPlace[this.currentPlayer - 1]--;
                if (checkMillForPosition(this.board, idx, this.currentPlayer)) {
                    this.mustRemove = true;
                } else {
                    this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
                }
                if (this.piecesToPlace[0] === 0 && this.piecesToPlace[1] === 0) {
                    this.phase = 'movement';
                }
            } else {
                if (this.selectedPiece === null) {
                    if (this.board[idx] !== this.currentPlayer) {
                        await button.deferUpdate();
                        return;
                    }
                    const isFlying = countPieces(this.board, this.currentPlayer) === 3;
                    const moves = getValidMoves(this.board, idx, isFlying);
                    if (moves.length === 0) {
                        await button.deferUpdate();
                        return;
                    }
                    this.selectedPiece = idx;
                } else {
                    const isFlying = countPieces(this.board, this.currentPlayer) === 3;
                    const valid = getValidMoves(this.board, this.selectedPiece, isFlying);
                    if (!valid.includes(idx) || this.board[idx] !== EMPTY) {
                        await button.deferUpdate();
                        return;
                    }
                    this.board[idx] = this.currentPlayer;
                    this.board[this.selectedPiece] = EMPTY;
                    this.selectedPiece = null;
                    if (checkMillForPosition(this.board, idx, this.currentPlayer)) {
                        this.mustRemove = true;
                    } else {
                        const opponentPlayer = this.currentPlayer === P1 ? P2 : P1;
                        const oppFlying = countPieces(this.board, opponentPlayer) === 3;
                        if (!hasLegalMove(this.board, opponentPlayer, oppFlying)) {
                            collector.stop('win');
                            const winner = gameData.find(g => g.player === this.currentPlayer).member;
                            if (guild && button.client.loyalty) {
                                await button.client.loyalty.addXp(50, winner, guild);
                            }
                            const winBuffer = await renderBoardImage(this.board);
                            const winAttach = new AttachmentBuilder(winBuffer, { name: 'morris_board.png' });
                            const winEmbed = new EmbedBuilder()
                                .setTitle('Nine Men\'s Morris')
                                .setDescription(getPlayerLine(challenger, opponent))
                                .setImage('attachment://morris_board.png')
                                .addFields({ name: 'Result', value: `${winner} wins!` })
                                .setColor(0x8B4513);
                            const disabledRows = buildButtonRows(this.board, state()).map(row => {
                                row.components.forEach(c => c.setDisabled(true));
                                return row;
                            });
                            await button.message.edit({
                                embeds: [winEmbed],
                                files: [winAttach],
                                components: disabledRows,
                            });
                            await button.deferUpdate();
                            return;
                        }
                        this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
                    }
                }
            }

            const newBuffer = await renderBoardImage(this.board);
            const newAttach = new AttachmentBuilder(newBuffer, { name: 'morris_board.png' });
            const newEmbed = new EmbedBuilder()
                .setTitle('Nine Men\'s Morris')
                .setDescription(getPlayerLine(challenger, opponent))
                .setImage('attachment://morris_board.png')
                .addFields({ name: 'Turn', value: getTurnContentWithMention(state(), challenger, opponent) })
                .setColor(0x8B4513);
            await button.message.edit({
                embeds: [newEmbed],
                files: [newAttach],
                components: buildButtonRows(this.board, state()),
            });
            await button.deferUpdate();
        });
    }
}
