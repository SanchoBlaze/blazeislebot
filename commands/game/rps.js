const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play rock ✊, paper ✋, scissors ✌️.'),
    async execute(interaction) {
        await interaction.reply({ content: 'Let\'s play a game of rock ✊, paper ✋, scissors ✌️!\nPlease choose using the emojis below!' });
        const message = await interaction.fetchReply();
        await message.react('✊');
        await message.react('✋');
        await message.react('✌️');

        const rps = ['✊', '✋', '✌️'];

        const botChoice = rps[Math.floor(Math.random() * rps.length)];

        const filter = (reaction, user) => {
            return rps.includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        message.awaitReactions({ filter: filter, max: 1, time: 10000 })
            .then(async collected => {
                const reaction = collected.first();
                const choice = reaction.emoji.name;

                message.reactions.removeAll().catch(error => console.error('Failed to clear reactions:', error));

                const choices = `You chose ${choice} and I chose ${botChoice}. `;
                let points = 10;

                if(choice === '✊' && botChoice === '✌️') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '✋' && botChoice === '✊') {
                    interaction.followUp(choices + 'You win! ');
                }
                else if (choice === '✌️' && botChoice === '✋') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === botChoice) {
                    interaction.followUp(choices + 'It\'s a tie!');
                    points = 0;
                }
                else {
                    interaction.followUp(choices + 'You lost!');
                    points = 0;
                }

                await interaction.client.loyalty.addXp(points, interaction.user, interaction.guild);

            })
            .catch(error => console.error('One of the emojis failed to react:', error));

    },
};