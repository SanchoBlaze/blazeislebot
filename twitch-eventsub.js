const config = require('config');
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

// Set the express server's port to the corresponding port of your ngrok tunnel
const port = 3000;

const clientId = config.get('Twitch.client_id');
const authToken = config.get('Twitch.client_id');
const callbackUrl = config.get('Twitch.callback_url');

app.post('/createWebhook/:broadcasterId', (req, res) => {
    const createWebHookParams = {
        host: 'api.twitch.tv',
        path: 'helix/eventsub/subscriptions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Client-ID': clientId,
            'Authorization': 'Bearer ' + authToken,
        },
    };
    const createWebHookBody = {
        'type': 'channel.follow',
        'version': '1',
        'condition': {
            'broadcaster_user_id': req.params.broadcasterId,
        },
        'transport': {
            'method': 'webhook',
            // For testing purposes you can use an ngrok https tunnel as your callback URL
            // If you change the /notification path make sure to also adjust in line 69
            'callback': callbackUrl + '/notification',
            // Replace with your own secret
            'secret': 'keepItSecretKeepItSafe',
        },
    };
    let responseData = '';
    const webhookReq = https.request(createWebHookParams, (result) => {
        result.setEncoding('utf8');
        result.on('data', function(d) {
            responseData = responseData + d;
        })
            .on('end', function(result) {
                const responseBody = JSON.parse(responseData);
                res.send(responseBody);
            });
    });
    webhookReq.on('error', (e) => { console.log('Error'); });
    webhookReq.write(JSON.stringify(createWebHookBody));
    webhookReq.end();
});

function verifySignature(messageSignature, messageID, messageTimestamp, body) {
    const message = messageID + messageTimestamp + body;
    // Remember to use the same secret set at creation
    const signature = crypto.createHmac('sha256', 'keepItSecretKeepItSafe').update(message);
    const expectedSignatureHeader = 'sha256=' + signature.digest('hex');

    return expectedSignatureHeader === messageSignature;
}

app.post('/notification', (req, res) => {
    if (!verifySignature(req.header('Twitch-Eventsub-Message-Signature'),
        req.header('Twitch-Eventsub-Message-Id'),
        req.header('Twitch-Eventsub-Message-Timestamp'),
        req.rawBody)) {
        // Reject requests with invalid signatures
        res.status(403).send('Forbidden');
    }
    else if (req.header('Twitch-Eventsub-Message-Type') === 'webhook_callback_verification') {
        console.log(req.body.challenge);
        // Returning a 200 status with the received challenge to complete webhook creation flow
        res.send(req.body.challenge);

    }
    else if (req.header('Twitch-Eventsub-Message-Type') === 'notification') {
        // Implement your own use case with the event data at this block
        console.log(req.body.event);
        // Default .send is a 200 status
        res.send('');
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Twitch Webhook Example listening at http://localhost:${port}`);
});