const Discord = require('discord.js');
const { Colours } = require('../../modules/colours');

module.exports = {
    name: 'server',
    description: 'Display info about this server.',
    guildOnly: true,
    execute(message) {
        function checkDays(date) {
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const days = Math.floor(diff / 86400000);
            return days + (days == 1 ? ' day' : ' days') + ' ago';
        }

        const serv = message.guild;
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
        const embed = new Discord.MessageEmbed()
            .setAuthor(message.guild.name, message.guild.iconURL())
            .addField('Name', message.guild.name, true)
            .addField('ID', message.guild.id, true)
            .addField('Owner', `${message.guild.owner.user.username}#${message.guild.owner.user.discriminator}`, true)
            .addField('Region', region[message.guild.region], true)
            .addField('Total | Humans | Bots', `${message.guild.members.cache.size} | ${message.guild.members.cache.filter(member => !member.user.bot).size} | ${message.guild.members.cache.filter(member => member.user.bot).size}`, true)
            .addField('Verification Level', verL, true)
            .addField('Channels', message.guild.channels.cache.size, true)
            .addField('Roles', message.guild.roles.cache.size, true)
            .addField('Creation Date', `${message.channel.guild.createdAt.toUTCString().substr(0, 16)} (${checkDays(message.channel.guild.createdAt)})`, true)
            .setColor(Colours.DARK_COLOURLESS)
            .setThumbnail(message.guild.iconURL());
        message.channel.send({ embed });
    },
};