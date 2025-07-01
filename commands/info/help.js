const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { Colours } = require('../../modules/colours');

// Emojis for categories
const categoryEmojis = {
    action: '❤️',
    admin: '🛡️',
    animal: '🐾',
    fun: '🎉',
    game: '🎮',
    info: 'ℹ️',
    loyalty: '💎',
    random: '🎲',
};

// Capitalize first letter
const ucfirst = (str) => str.charAt(0).toUpperCase() + str.slice(1);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all commands and descriptions.'),
    async execute(interaction) {
        const { client, user } = interaction;
        const commands = client.commands;

        // Fetch all deployed commands once to get their IDs
        const guildCommands = await interaction.guild.commands.fetch();
        const globalCommands = await client.application.commands.fetch();

        // Group commands by category
        const categories = commands.reduce((acc, command) => {
            const category = command.category || 'uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(command);
            return acc;
        }, {});

        const categoryNames = Object.keys(categories);

        // Create the initial home embed
        const getHomeEmbed = () => new EmbedBuilder()
            .setTitle('Blaze Isle Bot Help Menu')
            .setDescription('Welcome to the help menu! Please select a category from the dropdown below to view its commands.')
            .setColor(Colours.BLUE)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                categoryNames.map(cat => ({
                    name: `${categoryEmojis[cat] || '❓'} ${ucfirst(cat)}`,
                    value: `\`${categories[cat].length}\` commands`,
                    inline: true,
                }))
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) });
        
        // Create the select menu for categories
        const getCategorySelectMenu = () => new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help-category-select')
                    .setPlaceholder('Choose a category...')
                    .addOptions(
                        categoryNames.map(cat => ({
                            label: `${ucfirst(cat)}`,
                            value: cat,
                            emoji: categoryEmojis[cat] || '❓',
                        }))
                    )
            );

        // Create the "Back to Home" button
        const getHomeButton = () => new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help-home-button')
                    .setLabel('Back to Home')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏠')
            );
        
        await interaction.reply({
            embeds: [getHomeEmbed()],
            components: [getCategorySelectMenu()],
        });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            time: 120000, // 2 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'You cannot use this menu.', flags: MessageFlags.Ephemeral });
            }

            await i.deferUpdate();

            if (i.isStringSelectMenu()) {
                const category = i.values[0];
                const categoryCommands = categories[category];

                const categoryEmbed = new EmbedBuilder()
                    .setTitle(`${categoryEmojis[category] || '❓'} ${ucfirst(category)} Commands`)
                    .setColor(Colours.LIGHT_GREEN)
                    .setDescription(categoryCommands.map(cmd => {
                        const deployedCommand = guildCommands.find(c => c.name === cmd.data.name) || globalCommands.find(c => c.name === cmd.data.name);
                        const commandMention = deployedCommand ? `</${cmd.data.name}:${deployedCommand.id}>` : `/${cmd.data.name}`;
                        return `${commandMention}\n> ${cmd.data.description}`;
                    }).join('\n\n'))
                    .setTimestamp()
                    .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) });
                
                await i.editReply({ embeds: [categoryEmbed], components: [getHomeButton()] });
            }

            if (i.isButton()) {
                if (i.customId === 'help-home-button') {
                    await i.editReply({ embeds: [getHomeEmbed()], components: [getCategorySelectMenu()] });
                }
            }
        });

        collector.on('end', () => {
            const disabledSelect = getCategorySelectMenu();
            disabledSelect.components[0].setDisabled(true);
            interaction.editReply({ components: [disabledSelect] }).catch(() => {});
        });
    },
};