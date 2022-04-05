const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rpsls')
        .setDescription('Play rock ✊, paper ✋, scissors ✌️, lizard 🦎, Spock 🖖. Hail Sam Kass!'),
    async execute(interaction) {

        const rps = ['✊', '✋', '✌️', '🦎', '🖖'];

        const botChoice = rps[Math.floor(Math.random() * rps.length)];

        const message = await interaction.reply({ content: 'Let\'s play a game of rock ✊, paper ✋, scissors ✌️, lizard 🦎, Spock 🖖!\nPlease choose using the emojis below!', fetchReply: true });

        message.react('✊').then(() => message.react('✋')).then(() => message.react('✌️')).then(() => message.react('🦎')).then(() => message.react('🖖'));

        const filter = (reaction, user) => {
            return rps.includes(reaction.emoji.name) && user.id === interaction.user.id;
        };

        message.awaitReactions({ filter: filter, max: 1, time: 10000 })
            .then(collected => {
                const reaction = collected.first();
                const choice = reaction.emoji.name;

                message.reactions.removeAll().catch(error => console.error('Failed to clear reactions:', error));

                const choices = `You chose ${choice} and I chose ${botChoice}. `;
                let points = 10;

                if (choice === '✌️' && botChoice === '✋') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '✋' && botChoice === '✊') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '✊' && botChoice === '🦎') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '🦎' && botChoice === '🖖') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '🖖' && botChoice === '✌️') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '✌️' && botChoice === '🦎') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '🦎' && botChoice === '✋') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '✋' && botChoice === '🖖') {
                    interaction.followUp(choices + 'You win!');
                }
                else if (choice === '🖖' && botChoice === '✊') {
                    interaction.followUp(choices + 'You win!');
                }
                else if(choice === '✊' && botChoice === '✌️') {
                    interaction.followUp(choices + 'You win! ');
                }
                else if (choice === botChoice) {
                    interaction.followUp(choices + 'It\'s a tie!');
                    points = 0;
                }
                else {
                    interaction.followUp(choices + 'You lost!');
                    points = 0;
                }

                if(points) {
                    interaction.client.loyalty.addXp(points, interaction.user, interaction.guild);
                }

            })
            .catch(error => console.error('One of the emojis failed to react:', error));

    },
};