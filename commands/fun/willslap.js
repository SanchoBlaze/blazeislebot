const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const width = 500;
const height = 250;

const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'willslap.jpg');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('willslap')
        .setDescription('Will Slap someone.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to Will Slap.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('target');
        const will = interaction.user.displayAvatarURL({ format: 'png', dynamic: false, size: 64 });
        const chris = user.displayAvatarURL({ format: 'png', dynamic: false, size: 64 });

        const willFace = await loadImage(will);
        const chrisFace = await loadImage(chris);

        const background = await loadImage(imagePath);
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        context.drawImage(willFace, 300, 20, 64, 64);
        context.drawImage(chrisFace, 70, 30, 64, 64);

        const buffer = canvas.toBuffer();
        const attachment = new Discord.MessageAttachment(buffer, 'willslap.png');
        await interaction.reply({ content: `${interaction.user.username} Will Slapped ${user}`, files: [attachment] });
    },
};