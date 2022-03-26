const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play rock ✊, paper ✋, scissors ✌️.'),
    async execute(interaction) {

        const rps = ['✊', '✋', '✌️'];

        const botChoice = rps[Math.floor(Math.random() * rps.length)];

        const message = await interaction.reply({ content: 'Let\'s play a game of rock ✊, paper ✋, scissors ✌️!\nPlease choose using the emojis below!', fetchReply: true });

        message.react('✊').then(() => message.react('✋')).then(() => message.react('✌️'));

        const filter = (reaction, user) => {
            return rps.includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        let score = interaction.client.getScore.get(interaction.user.id, interaction.guild.id);
        if (!score) {
            score = { id: `${interaction.guild.id}-${interaction.user.id}`, user: interaction.user.id, guild: interaction.guild.id, points: 0, level: 1 };
        }

        message.awaitReactions({ filter: filter, max: 1, time: 10000 })
            .then(collected => {
                const reaction = collected.first();
                const choice = reaction.emoji.name;

                message.reactions.removeAll().catch(error => console.error('Failed to clear reactions:', error));

                const choices = `You chose ${choice} and I chose ${botChoice}. `;

                if(choice === '✊' && botChoice === '✌️') {
                    interaction.followUp(choices + 'You win!');
                    score.points += 10;
                }
                else if (choice === '✋' && botChoice === '✊') {
                    interaction.followUp(choices + 'You win! ');
                    score.points += 10;
                }
                else if (choice === '✌️' && botChoice === '✋') {
                    interaction.followUp(choices + 'You win!');
                    score.points += 10;
                }
                else if (choice === botChoice) {
                    interaction.followUp(choices + 'It\'s a tie!');
                }
                else {
                    interaction.followUp(choices + 'You lost!');
                }

                interaction.client.setScore.run(score);
            })
            .catch(error => console.error('One of the emojis failed to react:', error));

    },
};