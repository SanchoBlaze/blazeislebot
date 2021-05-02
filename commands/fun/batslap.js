const Discord = require('discord.js');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const width = 500;
const height = 250;

const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'batslap.jpg');

module.exports = {
    name: 'batslap',
    description: 'Bat Slap someone.',
    async execute(message) {
        if (!message.mentions.users.size) {
            return message.channel.send('"Please mention a user!');
        }
        const batman = message.author.displayAvatarURL({ format: 'png', dynamic: false, size: 64 });
        const robin = message.mentions.users.first().displayAvatarURL({ format: 'png', dynamic: false, size: 64 });

        const batmanFace = await loadImage(batman);
        const robinFace = await loadImage(robin);

        const background = await loadImage(imagePath);
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        context.drawImage(batmanFace, 290, 47, 64, 64);
        context.drawImage(robinFace, 142, 119, 64, 64);

        const buffer = canvas.toBuffer();
        const attachment = new Discord.MessageAttachment(buffer, 'batslap.png');
        message.channel.send(attachment);
    },
};