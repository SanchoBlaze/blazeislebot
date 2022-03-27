'use strict';

/**
 * A bot for the Blaze Isle Discord server.
 */

const config = require('config');
const Discord = require('discord.js');
const fs = require('fs');
const { Colours } = require('./modules/colours');
const SQLite = require('better-sqlite3');
const sql = new SQLite('./db/scores.sqlite');

// Create an instance of a Discord client
const intents = new Discord.Intents(8);
const client = new Discord.Client({ intents: [intents, Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Discord.Intents.FLAGS.GUILD_MEMBERS, Discord.Intents.FLAGS.DIRECT_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS] });
client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();
client.prefix = config.get('Command.prefix');
client.sql = sql;

const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    if(folder != 'utility') {
        const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${file}`);
            client.commands.set(command.data.name, command);
        }
    }
}


client.once('ready', () => {
    console.log('Blaze Isle Bot Online!');

    const table = sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'scores\';').get();
    if (!table['count(*)']) {
        // If the table isn't there, create it and setup the database correctly.
        sql.prepare('CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, guild TEXT, points INTEGER, level INTEGER);').run();
        // Ensure that the "id" row is always unique and indexed.
        sql.prepare('CREATE UNIQUE INDEX idx_scores_id ON scores (id);').run();
        sql.pragma('synchronous = 1');
        sql.pragma('journal_mode = wal');
    }

    // And then we have two prepared statements to get and set the score data.
    client.getScore = sql.prepare('SELECT * FROM scores WHERE user = ? AND guild = ?');
    client.setScore = sql.prepare('INSERT OR REPLACE INTO scores (id, user, guild, points, level) VALUES (@id, @user, @guild, @points, @level);');
});


client.on('guildMemberAdd', (member) => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'general');
    if (!channel) return;
    const embed = new Discord.MessageEmbed()
        .setTitle(`Welcome to **${member.guild}**`)
        .setDescription(`Hey ${member.user.toString()}, thanks for joining!`)
        .setColor(Colours.WELCOME_GREEN)
        .setThumbnail(member.user.displayAvatarURL());
    channel.send({ embeds: [embed] });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    if (command.guildOnly && interaction.channel.type === 'dm') {
        return interaction.reply('I can\'t execute that command inside DMs!');
    }

    if (command.role) {
        if (!interaction.member.roles.cache.some(role => role.name === command.role)) {
            return interaction.reply('You can not do this!');
        }
    }

    if (interaction.user.bot) return;

    let score;

    if (interaction.guild) {
        score = client.getScore.get(interaction.user.id, interaction.guild.id);
        if (!score) {
            score = { id: `${interaction.guild.id}-${interaction.user.id}`, user: interaction.user.id, guild: interaction.guild.id, points: 0, level: 1 };
        }
        // score.points++;
        const curLevel = Math.floor(0.1 * Math.sqrt(score.points));
        if (score.level < curLevel) {
            score.level++;
            interaction.reply(`${interaction.user} leveled up to level **${curLevel}**! Ain't that dandy?`);
        }
        client.setScore.run(score);
    }

    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});


/*
client.on('message', message => {
    if (!message.content.startsWith(client.prefix) || message.author.bot) return;

    const args = message.content.slice(client.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName)
		|| client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    if (command.guildOnly && message.channel.type === 'dm') {
        return message.reply('I can\'t execute that command inside DMs!');
    }

    if (command.permissions) {
        const authorPerms = message.channel.permissionsFor(message.author);
        if (!authorPerms || !authorPerms.has(command.permissions)) {
            return message.reply('You can not do this!');
        }
    }

    if (command.role) {
        if (!message.member.roles.cache.some(role => role.name === command.role)) {
            return message.reply('You can not do this!');
        }
    }

    if (command.args && !args.length) {
        let reply = `You didn't provide any arguments, ${message.author}!`;

        if (command.usage) {
            reply += `\nThe proper usage would be: \`${client.prefix}${command.name} ${command.usage}\``;
        }

        return message.channel.send(reply);
    }

    const { cooldowns } = client;

    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    try {
        command.execute(message, args);
    }
    catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
    }
});
*/

client.login(config.get('Discord.token'));