const websocket = {
    polymarket: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    deribit: 'wss://www.deribit.com/ws/api/v2'
}

const dataset = {
    capturedSpread: 0.3
}

const settings = {
    assets: ['BTC', 'ETH', 'SOL'],
    rfr: 0,
    fees: 0.0002,
    max_fees: 0.125,
}

module.exports = { settings, websocket, dataset }