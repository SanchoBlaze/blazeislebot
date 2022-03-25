const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const width = 500;
const height = 250;

const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'batslap.jpg');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('batslap')
        .setDescription('Bat Slap someone.')
        .addUserOption((option) =>
            option.setName('target')
                .setDescription('User to Bat Slap.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('target');
        const batman = interaction.user.displayAvatarURL({ format: 'png', dynamic: false, size: 64 });
        const robin = user.displayAvatarURL({ format: 'png', dynamic: false, size: 64 });

        const batmanFace = await loadImage(batman);
        const robinFace = await loadImage(robin);

        const background = await loadImage(imagePath);
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        context.drawImage(batmanFace, 290, 47, 64, 64);
        context.drawImage(robinFace, 142, 119, 64, 64);

        const buffer = canvas.toBuffer();
        const attachment = new Discord.MessageAttachment(buffer, 'batslap.png');
        await interaction.reply({ content: `${interaction.user.username} Bat Slapped ${user}`, files: [attachment] });
    },
};