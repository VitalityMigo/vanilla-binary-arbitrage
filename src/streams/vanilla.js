const WebSocket = require('ws');
const colors = require('colors')

const { vanillaToWs } = require('../utils');
const { updateVanillaOB } = require('../manager/db');

class vanillaWS {
    constructor(url) {
        this.url = url;
        this.ws = null;
    }

    start(channels) {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            const formattedChannels = vanillaToWs(channels)
            this.subscribe(formattedChannels);
            console.log(colors.blue('New: Vanilla options orderbook stream connected'))
        });

        this.ws.on('message', (e) => {
            const message = JSON.parse(e.toString()).params;
            if (message) {
                updateVanillaOB(message.data);
            }
        });

        this.ws.on('error', (error) => {
            console.error(colors.red('Error: An error occured with the vanilla orderbook stream', error));
        });

        this.ws.on('close', () => {
            console.log(colors.blue('Note: Vanilla options orderbook stream closed'))
        });
    }

    subscribe(channels) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const subscriptionMessage = {
                jsonrpc: "2.0",
                method: "public/subscribe",
                id: 42,
                params: {
                    channels: channels
                }
            };
            this.ws.send(JSON.stringify(subscriptionMessage));
        }
    }

    updateSubscription(channels) {
        this.subscribe(vanillaToWs(channels));
    }

    stop() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = vanillaWS