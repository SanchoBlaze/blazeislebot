const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');
const paginator = require('../../modules/paginator');
const { EmbedBuilder } = require('discord.js');

Object.defineProperty(String.prototype, 'ucfirst', {
    value: function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    },
    enumerable: false,
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all commands and descriptions.'),
    execute(interaction) {
        const commands = interaction.client.commands;

        let fieldCount = commands.size;

        let lastCategory = '';
        let categoryCount = 0;

        commands.forEach((cmd) => {
            const category = cmd.category.ucfirst();

            if (category !== lastCategory) {
                categoryCount++;
                lastCategory = category;
            }
        });

        fieldCount += (categoryCount * 2);

        const totalPages = Math.ceil(fieldCount / 25);

        lastCategory = '';
        let fields = 0;
        const pages = [];
        let page = 1;

        let embed = getEmbed(interaction, page, totalPages);


        commands.forEach((cmd) => {

            const category = cmd.category.ucfirst();

            if (category !== lastCategory) {
                fields += 2;
                if(fields + 3 >= 25) {
                    embed.setTimestamp();
                    pages.push(embed);
                    page++;
                    embed = getEmbed(interaction, page, totalPages);
                    fields = 0;
                }

                embed.addField('\u200B', '\u200B');
                embed.addField(`**${category}**`, `${category} commands.`);
                lastCategory = category;
            }
            fields += 1;
            if(fields + 1 >= 25) {
                embed.setTimestamp();
                pages.push(embed);
                page++;
                embed = getEmbed(interaction, page, totalPages);

                embed.addField('\u200B', '\u200B');
                embed.addField(`**${category}**`, `${category} commands continued.`);
                fields = 0;
            }

            embed.addField(
                `**/${cmd.data.name}**`,
                `${cmd.data.description}`,
                true,
            );
        });

        embed.setTimestamp();
        pages.push(embed);

        paginator(interaction, pages);

        // return interaction.reply({ embeds: [helpEmbed] });
    },
};

function getEmbed(interaction, page, totalPages) {
    const embed = new EmbedBuilder()
        .setTitle('Blaze Isle Bot Commands Help')
        .setDescription(`Page ${page} of  ${totalPages}`)
        .setColor(Colours.Colours.LIGHT_ORANGE)
        .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }));
    return embed;
}