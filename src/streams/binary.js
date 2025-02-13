const WebSocket = require('ws');
const colors = require('colors')

const { updateBinaryOB } = require('../manager/db');

class binaryWs {
    constructor(url) {
        this.url = url;
        this.ws = null;
    }

    start(assetIds) {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            console.log(colors.blue('New: Binary options orderbook stream connected'))
            this.subscribe(assetIds);
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.length > 0) {
                updateBinaryOB(message);
            }
        });

        this.ws.on('error', (error) => {
            console.error(colors.red('Error: An error occured with the binary orderbook stream', error));
        });

        this.ws.on('close', () => {
            console.log(colors.blue('Note: Binary options orderbook stream closed'))
        });
    }

    subscribe(assetIds) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const subscriptionMessage = JSON.stringify({
                type: 'Market',
                assets_ids: assetIds
            });
            this.ws.send(subscriptionMessage);
        }
    }

    updateSubscription(assetIds) {
        this.subscribe(assetIds);
    }

    stop() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = binaryWs;