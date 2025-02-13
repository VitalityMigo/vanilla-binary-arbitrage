const path = require('path');
const fs = require('fs');

const { dataset, settings } = require('../config')

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function num(str) {
    return parseFloat(str)
}

function cap(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function timeToDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function europeanMarkets(markets) {

    const assetWords = ["Bitcoin", "BTC", "$BTC", "Ethereum", "Ether", "ETH", "$ETH", "Solana", "SOL", "$SOL"]
    const limitWords = ["above", "below"]

    const response = markets.filter(i => {
        const question = i.question.toLowerCase();

        const wordsRegex = new RegExp(`\\b(${assetWords.join('|')})\\b`, 'i');
        const mandatoryRegex = new RegExp(`\\b(${limitWords.join('|')})\\b`, 'i');

        const additionalCondition = /\babove\b|\bbelow\b/.test(question) && !/\bdip\b|\bdips\b/.test(question);

        return wordsRegex.test(question) && mandatoryRegex.test(question) && additionalCondition;
    });

    return response
}

function extractSettings(markets) {
    const response = markets.flatMap(i => {
        const question = i.question;

        const direction = /\bhit\b|\bhits\b|\breach\b|\babove\b/.test(question) ? 'Call' :
            /\bbelow\b|\bdip\b|\bdips\b/.test(question) ? 'Put' : null;

        const match = question.match(/(\d{1,3}(?:[ ,]?\d{3})*(?:\.\d{1,2})?)(k?)/i);
        const strike = match ? parseFloat(match[1].replace(/[ ,]/g, '')) * (match[2] && match[2].toLowerCase() === 'k' ? 1000 : 1) : null;

        const expiry = i.endDate.split('T')[0];

        const assetMap = {
            "Bitcoin": "BTC", "BTC": "BTC", "$BTC": "BTC",
            "Ethereum": "ETH", "Ether": "ETH", "ETH": "ETH", "$ETH": "ETH",
            "Solana": "SOL", "SOL": "SOL", "$SOL": "SOL"
        };
        const asset = Object.keys(assetMap).find(key => question.includes(key)) ? assetMap[Object.keys(assetMap).find(key => question.includes(key))] : null;

        const clobIds = JSON.parse(i.clobTokenIds);

        const instrumentYes = optionId(expiry, strike, direction, asset);
        const instrumentNo = optionId(expiry, strike, direction === 'Call' ? 'Put' : 'Call', asset);

        return [
            {
                instrument: instrumentYes,
                type: 'Binary',
                asset: asset,
                direction,
                strike,
                style: 'EU',
                expiry: i.endDate.split('T')[0],
                market: {
                    tile: i.question,
                    outcome: 'Yes',
                    clobId: clobIds[0],
                    link: `https://polymarket.com/market/${i.slug}`
                }
            },
            {
                instrument: instrumentNo,
                type: 'Binary',
                asset: asset,
                direction: direction === 'Call' ? 'Put' : 'Call',
                strike,
                style: 'EU',
                expiry: i.endDate.split('T')[0],
                market: {
                    tile: i.question,
                    outcome: 'No',
                    clobId: clobIds[1],
                    link: `https://polymarket.com/market/${i.slug}`
                }
            }
        ];
    });

    return response;
}

function markToBinary(markets) {
    const european = europeanMarkets(markets);
    const binaries = extractSettings(european);
    return binaries
}

function callToVanilla(instruments) {

    const response = instruments.map(i => {


        return {
            instrument: i.instrument_name,
            type: 'Vanilla',
            asset: i.base_currency,
            direction: cap(i.option_type),
            strike: i.strike,
            style: 'EU',
            expiry: timeToDate(i.expiration_timestamp),
        }
    })

    return response
}

function filterVanillasToMatch(vanilla) {

    // Fetch binary options
    const liveFilePath = path.resolve(__dirname, '../data/binary/instruments.json');
    const binaryArray = JSON.parse(fs.readFileSync(liveFilePath, 'utf8')) || [];

    // Filter to Match
    return vanilla.filter(vanilla =>
        binaryArray.some(binary =>
            vanilla.asset === binary.asset && vanilla.expiry === binary.expiry)
    )
}

function formatBinaryOB(rawData) {

    // Settings
    const capturedSpread = dataset.capturedSpread

    // Anchor figures (BBO and mark price)
    const mid = getBinaryMarkAndSpread(rawData)
    const markPrice = mid.markPrice
    const spread = mid.spread

    // Filtered orderbook
    const bids = rawData.bids.filter(i => i.price >= markPrice * (1 - capturedSpread)).map(item => ({ price: num(item.price), size: num(item.size) }))
    const asks = rawData.asks.filter(i => i.price <= markPrice * (1 + capturedSpread)).map(item => ({ price: num(item.price), size: num(item.size) }))

    const result = {
        mark: markPrice,
        spread: spread,
        bids: bids,
        asks: asks
    }

    return result
}

function formatVanillaOB(rawData) {

    const mid = getVanillaMarkAndSpread(rawData, 'initial')
    const markPrice = mid.markPrice
    const spread = mid.spread

    // No book
    if (markPrice === null) { return { mark: markPrice, spread: spread, bids: [], asks: [] } }

    // Filtered orderbook
    const bids = rawData.bids.length > 0 ? rawData.bids.map(item => ({ price: item[1], size: item[2] })) : []
    const asks = rawData.asks.length > 0 ? rawData.asks.map(item => ({ price: item[1], size: item[2] })) : []

    const result = {
        mark: markPrice,
        spread: spread,
        bids: bids,
        asks: asks
    }

    return result
}

function getBinaryMarkAndSpread(rawData) {
    // Anchor figures (BBO and mark price)
    const BBO = { bid: num(rawData.bids[rawData.bids.length - 1].price), ask: num(rawData.asks[rawData.asks.length - 1].price) }
    const markPrice = (BBO.bid + BBO.ask) / 2
    const spread = BBO.ask - BBO.bid
    return { markPrice, spread }
}

function getVanillaMarkAndSpread(rawData, stage) {

    // Anchor figures (BBO and mark price)
    const BBO = stage === 'initial' ? {
        bid: rawData.bids.length > 0 ? num(rawData.bids[0][1]) : null,
        ask: rawData.asks.length > 0 ? num(rawData.asks[0][1]) : null,
    } : {
        bid: rawData.bids.length > 0 ? num(rawData.bids[0].price) : null,
        ask: rawData.asks.length > 0 ? num(rawData.asks[0].price) : null,
    }


    // Conditions
    const oneNull = BBO.bid === null || BBO.ask === null
    const bothNull = BBO.bid === null && BBO.ask === null

    if (bothNull) { return { markPrice: null, spread: null } }

    const markPrice = !oneNull ? (BBO.bid + BBO.ask) / 2 : BBO.ask || BBO.bid
    const spread = !oneNull ? BBO.ask - BBO.bid : null
    return { markPrice, spread }

}

function optionId(date, strike, direction, asset) {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    const [year, month, day] = date.split('-');
    const formattedDate = `${day}${months[parseInt(month) - 1]}${year.slice(-2)}`;
    const formattedStrike = strike.toString().replace('.', '');
    const formattedDirection = direction === 'Call' ? 'C' : 'P';

    return `${asset}-${formattedDate}-${formattedStrike}-${formattedDirection}`;
}

function getClobIds() {
    // Init. stream binary orderbook
    const filePath = path.resolve(__dirname, '../data/binary/instruments.json');
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const assetIds = fileData.map(i => i.market.clobId)
    return assetIds
}

function getVanillaNames() {
    // Init. stream binary orderbook
    const filePath = path.resolve(__dirname, '../data/vanilla/instruments.json');
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const assetIds = fileData.map(i => i.instrument)
    return assetIds
}

function getSpotNames() {
    const names = []
    if (settings.assets.includes('BTC')) { names.push('BTC_USDC') }
    if (settings.assets.includes('ETH')) { names.push('ETH_USDC') }
    if (settings.assets.includes('SOL')) { names.push('SOL_USDC') }
    return names
}

function getBinaryByClob(clob) {
    const filePath = path.resolve(__dirname, '../data/binary/instruments.json');
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const binary = fileData.find(i => i.market.clobId === clob);
    return binary
}

function getOptionsDB() {

    // Files Path
    const vanillaInstPath = path.resolve(__dirname, '../data/vanilla/instruments.json');
    const vanillaOBPath = path.resolve(__dirname, '../data/vanilla/orderbook.json');
    const binaryInstPath = path.resolve(__dirname, '../data/binary/instruments.json');
    const binaryOBPath = path.resolve(__dirname, '../data/binary/orderbook.json');
    const spotPath = path.resolve(__dirname, '../data/spot.json');

    const vanillaOptions = JSON.parse(fs.readFileSync(vanillaInstPath, 'utf8')) || [];
    const binaryOptions = JSON.parse(fs.readFileSync(binaryInstPath, 'utf8')) || [];
    const vanillaOB = JSON.parse(fs.readFileSync(vanillaOBPath, 'utf8')) || [];
    const binaryOB = JSON.parse(fs.readFileSync(binaryOBPath, 'utf8')) || [];
    const spot = JSON.parse(fs.readFileSync(spotPath, 'utf8')) || [];

    return { vanillaOptions, polyOptions: binaryOptions, vanillaOB, binaryOB, spot }
}


function vanillaToWs(vanilla) {
    return vanilla.map(i => `book.${i}.agg2`);
}

function spotToWS(spot) {
    return spot.map(i => `ticker.${i}.agg2`);
}

function relevantBinary(binary) {

    return binary.filter(B => {

        const asset = B.asset
        const strike = B.strike
        const spot = getSpot(asset)
        const dir = spot < strike ? 'Put' : 'Call'

        return B.direction === dir
    })
}

function getSpot(asset) {
    const spotPath = path.resolve(__dirname, '../data/spot.json');
    const spotData = JSON.parse(fs.readFileSync(spotPath, 'utf8'));
    return spotData[asset]
}

function matchVantoBin(vanilla, binary) {
    const asset = binary.asset
    const expiry = binary.expiry
    const direction = binary.direction
    return vanilla.filter(i => i.asset === asset && i.expiry === expiry && i.direction !== direction)
}

function getBBO(type, instrument) {

    if (type === 'binary') {

        // Files Path
        const binaryOBPath = path.resolve(__dirname, '../data/binary/orderbook.json');
        const binaryOB = JSON.parse(fs.readFileSync(binaryOBPath, 'utf8')) || [];

        const orderbook = binaryOB.find(i => i.instrument === instrument)

        // Best bids
        const filteredBids = orderbook.bids.filter(item => item.size > 0)
        const bestBid = filteredBids.length > 0 ? filteredBids.reduce((max, item) => item.price > max.price ? item : max).price : null

        // Best asks
        const filteredAsks = orderbook.asks.filter(item => item.size > 0)
        const bestAsk = filteredAsks.length > 0 ? filteredAsks.reduce((min, item) => item.price < min.price ? item : min).price : null

        return { bid: bestBid, ask: bestAsk }

    } else if (type === 'vanilla') {

        // Files Path
        const vanillaOBPath = path.resolve(__dirname, '../data/vanilla/orderbook.json');
        const vanillaOB = JSON.parse(fs.readFileSync(vanillaOBPath, 'utf8')) || [];

        const orderbook = vanillaOB.find(i => i.instrument === instrument)

        // Best bids
        const filteredBids = orderbook.bids.filter(item => item.size > 0)
        const bestBid = filteredBids.length > 0 ? filteredBids.reduce((max, item) => item.price > max.price ? item : max).price : null

        // Best asks
        const filteredAsks = orderbook.asks.filter(item => item.size > 0)
        const bestAsk = filteredAsks.length > 0 ? filteredAsks.reduce((min, item) => item.price < min.price ? item : min).price : null

        return { bid: bestBid, ask: bestAsk }
    }
}

function timeToExpiry(expiryStr) {
    const date = new Date((new Date()).toISOString())
    const expiry = new Date(`${expiryStr}T08:00:00Z`);

    // Diff (MS)
    const diffInMs = expiry - date;

    // MS to D
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    // D to Y
    return diffInDays / 365;
}


module.exports = {
    markToBinary, callToVanilla, filterVanillasToMatch,
    sleep, num, getClobIds, getBinaryByClob, formatVanillaOB,
    formatBinaryOB, getOptionsDB, getBinaryMarkAndSpread,
    vanillaToWs, getVanillaNames, matchVantoBin, relevantBinary,
    getVanillaMarkAndSpread, getSpotNames, spotToWS, 
    getBBO, getSpot, timeToExpiry
}