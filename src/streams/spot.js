const WebSocket = require('ws');
const colors = require('colors')

const { spotToWS } = require('../utils');
const { updateSpot } = require('../manager/db');


class spotWS {
    constructor(url) {
        this.url = url;
        this.ws = null;
    }

    start(channels) {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            const formattedChannels = spotToWS(channels)
            this.subscribe(formattedChannels);
            console.log(colors.blue('New: Spot prices stream connected'))
        });

        this.ws.on('message', (e) => {
            const message = JSON.parse(e.toString()).params;
            if (message) {
                updateSpot(message.data);
            }
        });

        this.ws.on('error', (error) => {
            console.error(colors.red('An error occured with the spot prices stream', error));
        });

        this.ws.on('close', () => {
            console.log(colors.blue('Note: Spot prices stream closed'))
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
        this.subscribe(spotToWS(channels));
    }

    stop() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = spotWS