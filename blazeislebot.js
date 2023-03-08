'use strict';

/**
 * A bot for the Blaze Isle Discord server.
 */

const config = require('config');
const Discord = require('discord.js');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        // Small modification to the JSON bodyParser to expose the raw body in the request object
        // The raw body is required at signature verification
        req.rawBody = buf;
    },
}));

const https = require('https');
const crypto = require('crypto');

const Database = require('./modules/database');
const Colours = require('./modules/colours');
const Loyalty = require('./modules/loyalty');


// Create an instance of a Discord client
const intents = new Discord.Intents(8);
const client = new Discord.Client({
    partials: ['CHANNEL'],
    intents: [intents, Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Discord.Intents.FLAGS.GUILD_MEMBERS, Discord.Intents.FLAGS.DIRECT_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS]
});


client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();

const db = new Database();
client.db = db;

const loyalty = new Loyalty();
client.loyalty = loyalty;


const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        command.category = folder;
        client.commands.set(command.data.name, command);
    }
}


client.once('ready', () => {
    console.log('Blaze Isle Bot Online!');
});


client.on('guildMemberAdd', (member) => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'general');
    if (!channel) return;
    const embed = new Discord.MessageEmbed()
        .setTitle(`Welcome to **${member.guild}**`)
        .setDescription(`Hey ${member.user.toString()}, thanks for joining!`)
        .setColor(Colours.WELCOME_GREEN)
        .setThumbnail(member.user.displayAvatarURL());
    channel.send({embeds: [embed]});

    client.loyalty.addUser(member.user, member.guild);
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


    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        return interaction.reply({content: 'There was an error while executing this command!', ephemeral: true});
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

/**
 * The below section deals with running a webserver for Twitch Eventsub
 */

// Set the express server's port to the corresponding port of your ngrok tunnel
const port = 3000;

const clientId = config.get('Twitch.client_id');
const authToken = config.get('Twitch.token');
const callbackUrl = config.get('Twitch.callback_url');

app.post('/createWebhook/:broadcasterId', (req, res) => {
    const createWebHookParams = {
        host: 'api.twitch.tv', path: 'helix/eventsub/subscriptions', method: 'POST', headers: {
            'Content-Type': 'application/json', 'Client-ID': clientId, 'Authorization': 'Bearer ' + authToken,
        },
    };
    const createWebHookBody = {
        'type': 'channel.follow', 'version': '1', 'condition': {
            'broadcaster_user_id': req.params.broadcasterId,
        }, 'transport': {
            'method': 'webhook', 'callback': callbackUrl + '/notification', 'secret': config.get('Twitch.secret'),
        },
    };
    let responseData = '';
    const webhookReq = https.request(createWebHookParams, (result) => {
        result.setEncoding('utf8');
        result.on('data', function (d) {
            responseData = responseData + d;
        })
            .on('end', function () {
                const responseBody = JSON.parse(responseData);
                res.send(responseBody);
            });
    });
    webhookReq.on('error', (e) => {
        console.log('Error: ' + e.message);
    });
    webhookReq.write(JSON.stringify(createWebHookBody));
    webhookReq.end();
});

function verifySignature(messageSignature, messageID, messageTimestamp, body) {
    const message = messageID + messageTimestamp + body;
    // Remember to use the same secret set at creation
    const signature = crypto.createHmac('sha256', config.get('Twitch.secret')).update(message);
    const expectedSignatureHeader = 'sha256=' + signature.digest('hex');

    return expectedSignatureHeader === messageSignature;
}

app.post('/notification', (req, res) => {
    if (!verifySignature(req.header('Twitch-Eventsub-Message-Signature'), req.header('Twitch-Eventsub-Message-Id'), req.header('Twitch-Eventsub-Message-Timestamp'), req.rawBody)) {
        // Reject requests with invalid signatures
        res.status(403).send('Forbidden');
    } else if (req.header('Twitch-Eventsub-Message-Type') === 'webhook_callback_verification') {
        console.log(req.body.challenge);
        // Returning a 200 status with the received challenge to complete webhook creation flow
        res.send(req.body.challenge);

    } else if (req.header('Twitch-Eventsub-Message-Type') === 'notification') {
        // Implement your own use case with the event data at this block
        console.log(req.body.event);
        // Default .send is a 200 status
        res.send('');
    }
});

app.get('/', (req, res) => {
    res.send('Blaze Isle!');
});

app.listen(port, () => {
    console.log('Blaze Isle Web Online!');
});