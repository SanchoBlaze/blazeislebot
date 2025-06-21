const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

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
        const batman = interaction.user.displayAvatarURL({ extension: 'png', forceStatic: true });
        const robin = user.displayAvatarURL({ extension: 'png', forceStatic: true });

        const batmanFace = await loadImage(batman);
        const robinFace = await loadImage(robin);

        const canvas = createCanvas(500, 250);
        const context = canvas.getContext('2d');
        const background = await loadImage('./assets/batslap.jpg');
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        context.drawImage(batmanFace, 290, 47, 64, 64);
        context.drawImage(robinFace, 142, 119, 64, 64);

        const buffer = canvas.toBuffer();
        const attachment = new AttachmentBuilder(buffer, { name: 'batslap.png' });
        await interaction.reply({ content: `${interaction.user.username} Bat Slapped ${user}`, files: [attachment] });
    },
};