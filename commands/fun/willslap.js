const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

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
        const will = interaction.user.displayAvatarURL({ extension: 'png', forceStatic: true });
        const chris = user.displayAvatarURL({ extension: 'png', forceStatic: true });

        const willFace = await loadImage(will);
        const chrisFace = await loadImage(chris);

        const canvas = createCanvas(497, 353);
        const context = canvas.getContext('2d');
        const background = await loadImage('./assets/willslap.jpg');
        context.drawImage(background, 0, 0, canvas.width, canvas.height);

        context.drawImage(willFace, 300, 35, 64, 64);
        context.drawImage(chrisFace, 70, 60, 64, 64);

        const buffer = canvas.toBuffer();
        const attachment = new AttachmentBuilder(buffer, { name: 'willslap.png' });
        await interaction.reply({ content: `${interaction.user.username} Will Slapped ${user}`, files: [attachment] });
    },
};