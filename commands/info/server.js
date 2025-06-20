const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Colours } = require('../../modules/colours');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Display info about this server.'),
    guildOnly: true,
    async execute(interaction) {
        function checkDays(date) {
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const days = Math.floor(diff / 86400000);
            return days + (days == 1 ? ' day' : ' days') + ' ago';
        }

        const serv = interaction.guild;
        let verL = 'None (No Restriction)';
        switch(serv.verificationLevel) {
        case '1':
            verL = 'Low (Verified Account)';
            break;
        case '2':
            verL = 'Medium (Verified Account for 5 minutes+)';
            break;
        case '3':
            verL = 'Secure (Verified Account & Guild member for 10+ minutes)';
            break;
        case '4':
            verL = 'Intense (Verified Account & Verified Phone linked)';
            break;

        }
        /*
        const region = {
            'brazil': ':flag_br: Brazil',
            'eu-central': ':flag_eu: Central Europe',
            'singapore': ':flag_sg: Singapore',
            'us-central': ':flag_us: U.S. Central',
            'sydney': ':flag_au: Sydney',
            'us-east': ':flag_us: U.S. East',
            'us-south': ':flag_us: U.S. South',
            'us-west': ':flag_us: U.S. West',
            'eu-west': ':flag_eu: Western Europe',
            'vip-us-east': ':flag_us: VIP U.S. East',
            'london': ':flag_gb: London',
            'amsterdam': ':flag_nl: Amsterdam',
            'hongkong': ':flag_hk: Hong Kong',
            'russia': ':flag_ru: Russia',
            'southafrica': ':flag_za:  South Africa',
        };

        const local = {
            'da' : 'Danish',
            'de' : 'German',
            'en-GB' : ':flag_gb: English, UK',
            'en-US' : 'English, US',
            'es-ES' : 'Spanish',
            'fr' : 'French',
            'hr' : 'Croatian',
            'it' : 'Italian',
            'lt' : 'Lithuanian',
            'hu' : 'Hungarian',
            'nl' : ':flag_nl: Dutch',
            'no' : 'Norwegian',
            'pl' : 'Polish',
            'pt-BR' : ':flag_br: Portuguese, Brazilian',
            'ro' : 'Romanian, Romania',
            'fi' : 'Finnish',
            'sv-SE' : 'Swedish',
            'vi' : 'Vietnamese',
            'tr' : 'Turkish',
            'cs' : 'Czech',
            'el' : 'Greek',
            'bg' : 'Bulgarian',
            'ru' : 'Russian',
            'uk' : 'Ukrainian',
            'hi' : 'Hindi',
            'th' : 'Thai',
            'zh-CN' : 'Chinese, China',
            'ja' : 'Japanese',
            'zh-TW' : 'Chinese, Taiwan',
            'ko' : 'Korean',
        };
*/
        const roles = await interaction.guild.roles.fetch();
        const members = await interaction.guild.members.fetch();
        const channels = await interaction.guild.channels.fetch();
        const owner = members.find(member => member.id === interaction.guild.ownerId);
        const textChannels = channels.filter(channel => channel.type === 'GUILD_TEXT');
        const voiceChannels = channels.filter(channel => channel.type === 'GUILD_VOICE');
        const channelTotal = textChannels.size + voiceChannels.size;

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .addFields(
                { name: 'Name', value: interaction.guild.name, inline: true },
                { name: 'ID', value: interaction.guild.id, inline: true },
                { name: 'Owner', value: owner.user.username, inline: true },
                { name: 'Total | Humans | Bots', value: `${interaction.guild.members.cache.size} | ${interaction.guild.members.cache.filter(member => !member.user.bot).size} | ${interaction.guild.members.cache.filter(member => member.user.bot).size}`, inline: true },
                { name: 'Verification Level', value: verL, inline: true },
                { name: 'Channels | Text | Voice', value: channelTotal + ' | ' + textChannels.size + ' | ' + voiceChannels.size, inline: true },
                { name: 'Roles', value: roles.size.toString(), inline: true },
                { name: 'Boost Tier', value: `${interaction.guild.premiumTier}`, inline: true },
                { name: 'Boost Level', value: `${interaction.guild.premiumSubscriptionCount}`, inline: true },
                { name: 'Creation Date', value: `${interaction.channel.guild.createdAt.toUTCString().substr(0, 16)} (${checkDays(interaction.channel.guild.createdAt)})`, inline: true }
            )
            .setColor(Colours.Colours.DARK_COLOURLESS)
            .setThumbnail(interaction.guild.iconURL());
        return interaction.reply({ embeds: [embed] });
    },
};