const fs = require('fs');
const path = require('path');
const colors = require('colors')

const { fetchMarkets } = require('../streams/markets');
const { fetchVanilla } = require('../streams/deribit');
const { getClobIds, getVanillaNames, getBinaryByClob, formatBinaryOB, formatVanillaOB, num, getBinaryMarkAndSpread, getVanillaMarkAndSpread } = require('../utils');
const solver = require('../model/solver');

async function updateMarkets() {

    // Fetch live markets
    const data = await fetchMarkets();

    // Intermediary tools
    const newInstruments = []

    // Register new markets
    const liveFilePath = path.resolve(__dirname, '../../data/binary/instruments.json');
    const orderbookFilePath = path.resolve(__dirname, '../../data/binary/orderbook.json');

    const binaryArray = JSON.parse(fs.readFileSync(liveFilePath, 'utf8')) || [];
    const orderbookArray = JSON.parse(fs.readFileSync(orderbookFilePath, 'utf8')) || [];
    const liveInstruments = binaryArray.map(i => i.instrument);

    // Copy of the array and array comparison function
    const initBinaryArrai = JSON.parse(JSON.stringify(binaryArray));
    const arraysEqual = (arr1, arr2) => arr1.length === arr2.length && arr1.every((element, index) => JSON.stringify(element) === JSON.stringify(arr2[index]));

    // Add new instruments
    data.forEach(item => {
        if (!liveInstruments.includes(item.instrument)) {
            // Add instrument
            binaryArray.push(item);
            newInstruments.push(item);
        }
    });

    // Filtered expired instruments contract settings
    const newBinaryArray = binaryArray.filter(item => {
        const date = new Date();
        const expiryDate = new Date(item.expiry + 'T08:00:00Z');
        return date < expiryDate;
    });

    // Filtered expired instruments orderbook
    const newOrderbookArray = orderbookArray.filter(item => {
        const instrument = binaryArray.find(i => i.instrument === item.instrument);
        return instrument !== undefined;
    });

    // Writing updated binary data to live file
    fs.writeFileSync(orderbookFilePath, JSON.stringify(newOrderbookArray, null, 2), 'utf8');
    fs.writeFileSync(liveFilePath, JSON.stringify(newBinaryArray, null, 2), 'utf8');

    // Log binary orderbooks
    if (!arraysEqual(initBinaryArrai, newBinaryArray)) {
        const newClobIds = getClobIds();

        try {
            const { BinaryWSManager } = require('./ws');
            BinaryWSManager.updateSubscription(newClobIds);
        } catch (error) { }
    }
    console.log(colors.blue('Note: Updated binary options'));
}

function updateBinaryOB(message) {

    // Get file and path
    const filePath = path.resolve(__dirname, '../../data/binary/orderbook.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const binaryOB = JSON.parse(fileData) || [];

    for (const item of message) {

        const event_type = item.event_type
        const clobId = item.asset_id
        const changes = item.changes

        // Fetch binary contract
        const binary = getBinaryByClob(clobId);
        const index = binaryOB.findIndex(i => i.instrument === binary.instrument);

        if (event_type === 'price_change') {

            changes.forEach(change => {
                const { price, side, size } = change;
                const priceLevel = num(price);
                const sizeLevel = num(size);

                if (side === 'BUY') {
                    const bidIndex = binaryOB[index].bids.findIndex(bid => bid.price === priceLevel);
                    if (sizeLevel === 0) {
                        if (bidIndex !== -1) {
                            binaryOB[index].bids.splice(bidIndex, 1);
                        }
                    } else {
                        if (bidIndex !== -1) {
                            binaryOB[index].bids[bidIndex].size = sizeLevel;
                        } else {
                            const insertIndex = binaryOB[index].bids.findIndex(bid => bid.price > priceLevel);
                            if (insertIndex === -1) {
                                binaryOB[index].bids.push({ price: priceLevel, size: sizeLevel });
                            } else {
                                binaryOB[index].bids.splice(insertIndex, 0, { price: priceLevel, size: sizeLevel });
                            }
                        }
                    }
                } else if (side === 'SELL') {
                    const askIndex = binaryOB[index].asks.findIndex(ask => ask.price === priceLevel);
                    if (sizeLevel === 0) {
                        if (askIndex !== -1) {
                            binaryOB[index].asks.splice(askIndex, 1);
                        }
                    } else {
                        if (askIndex !== -1) {
                            binaryOB[index].asks[askIndex].size = sizeLevel;
                        } else {
                            const insertIndex = binaryOB[index].asks.findIndex(ask => ask.price > priceLevel);
                            if (insertIndex === -1) {
                                binaryOB[index].asks.push({ price: priceLevel, size: sizeLevel });
                            } else {
                                binaryOB[index].asks.splice(insertIndex, 0, { price: priceLevel, size: sizeLevel });
                            }
                        }
                    }
                }

                const mid = getBinaryMarkAndSpread(binaryOB[index]);
                binaryOB[index].mark = mid.markPrice;
                binaryOB[index].spread = mid.spread;
            });

        } else if (event_type === 'book') {

            // Get instrument info
            const objOB = { instrument: binary.instrument, ...formatBinaryOB(item) }

            if (index !== -1) {
                // Replace existing object
                binaryOB[index] = objOB;
            } else {
                // Add new object
                binaryOB.push(objOB);
            }
        }
    }

    // Writing updated binary orderbook to live file
    fs.writeFileSync(filePath, JSON.stringify(binaryOB, null, 2), 'utf8');

    // Launch Solver
    try { solver() } catch (error) { }
}

async function updateVanilla() {

    // Fetch live vanilla
    const data = await fetchVanilla()
    const newInstruments = []

    // Register new markets
    const liveFilePath = path.resolve(__dirname, '../../data/vanilla/instruments.json');
    const orderbookFilePath = path.resolve(__dirname, '../../data/vanilla/orderbook.json');

    const vanillaArray = JSON.parse(fs.readFileSync(liveFilePath, 'utf8')) || [];
    const orderbookArray = JSON.parse(fs.readFileSync(orderbookFilePath, 'utf8')) || [];
    const liveInstruments = vanillaArray.map(i => i.instrument);

    // Copy of the array and array comparison function
    const initBinaryArrai = JSON.parse(JSON.stringify(vanillaArray));
    const arraysEqual = (arr1, arr2) => arr1.length === arr2.length && arr1.every((element, index) => JSON.stringify(element) === JSON.stringify(arr2[index]));

    // Add new instruments
    data.forEach(item => {
        if (!liveInstruments.includes(item.instrument)) {
            // Add instrument
            vanillaArray.push(item);
            newInstruments.push(item);
        }
    });

    // Filtered expired instruments contract settings
    const newVanillaArray = vanillaArray.filter(item => {
        const date = new Date();
        const expiryDate = new Date(item.expiry + 'T08:00:00Z');
        return date < expiryDate;
    });

    // Filtered expired instruments orderbook
    const newOrderbookArray = orderbookArray.filter(item => {
        const instrument = vanillaArray.find(i => i.instrument === item.instrument);
        return instrument !== undefined;
    });

    // Writing updated binary data to live file
    fs.writeFileSync(orderbookFilePath, JSON.stringify(newOrderbookArray, null, 2), 'utf8');
    fs.writeFileSync(liveFilePath, JSON.stringify(newVanillaArray, null, 2), 'utf8');

    // Log binary orderbooks
    if (!arraysEqual(initBinaryArrai, vanillaArray)) {
        const newInstrumentNames = getVanillaNames();

        try {
            const { VanillaWSManager } = require('./ws');
            VanillaWSManager.updateSubscription(newInstrumentNames);
        } catch (error) { }
    }

    console.log(colors.blue('Note: Updated vanilla options'));
}

function updateVanillaOB(message) {

    // Get file and path
    const filePath = path.resolve(__dirname, '../../data/vanilla/orderbook.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const vanillaOB = JSON.parse(fileData) || [];

    const instrument = message.instrument_name
    const type = message.type

    const index = vanillaOB.findIndex(i => i.instrument === instrument);

    if (type === 'snapshot') {

        // Get instrument info
        const objOB = { instrument: instrument, ...formatVanillaOB(message) }

        if (index !== -1) {
            // Replace existing object
            vanillaOB[index] = objOB;
        } else {
            // Add new object
            vanillaOB.push(objOB);
        }

    } else if (type === 'change') {
        // Get bids and asks value from message
        const { bids, asks } = message

        bids.forEach(change => {
            const action = change[0]
            const priceLevel = change[1]
            const sizeLevel = change[2]

            if (action === 'change' || action === 'new') {
                const bidIndex = vanillaOB[index].bids.findIndex(bid => bid.price === priceLevel);
                if (bidIndex !== -1) {
                    vanillaOB[index].bids[bidIndex].size = sizeLevel;
                } else {
                    const insertIndex = vanillaOB[index].bids.findIndex(bid => bid.price > priceLevel);
                    if (insertIndex === -1) {
                        vanillaOB[index].bids.push({ price: priceLevel, size: sizeLevel });
                    } else {
                        vanillaOB[index].bids.splice(insertIndex, 0, { price: priceLevel, size: sizeLevel });
                    }
                }
            } else if (action === 'delete') {
                const bidIndex = vanillaOB[index].bids.findIndex(bid => bid.price === priceLevel);
                if (bidIndex !== -1) {
                    vanillaOB[index].bids.splice(bidIndex, 1);
                }
            }

            const mid = getVanillaMarkAndSpread(vanillaOB[index], 'live');
            vanillaOB[index].mark = mid.markPrice;
            vanillaOB[index].spread = mid.spread;
        });

        asks.forEach(change => {
            const action = change[0]
            const priceLevel = change[1]
            const sizeLevel = change[2]

            if (action === 'change' || action === 'new') {
                const bidIndex = vanillaOB[index].asks.findIndex(bid => bid.price === priceLevel);
                if (bidIndex !== -1) {
                    vanillaOB[index].asks[bidIndex].size = sizeLevel;
                } else {
                    const insertIndex = vanillaOB[index].asks.findIndex(bid => bid.price > priceLevel);
                    if (insertIndex === -1) {
                        vanillaOB[index].asks.push({ price: priceLevel, size: sizeLevel });
                    } else {
                        vanillaOB[index].asks.splice(insertIndex, 0, { price: priceLevel, size: sizeLevel });
                    }
                }
            } else if (action === 'delete') {
                const bidIndex = vanillaOB[index].asks.findIndex(bid => bid.price === priceLevel);
                if (bidIndex !== -1) {
                    vanillaOB[index].asks.splice(bidIndex, 1);
                }
            }

            const mid = getVanillaMarkAndSpread(vanillaOB[index]);
            vanillaOB[index].mark = mid.markPrice;
            vanillaOB[index].spread = mid.spread;
        });

    }

    // Writing updated binary orderbook to live file
    fs.writeFileSync(filePath, JSON.stringify(vanillaOB, null, 2), 'utf8');

    // Launch Solver
    try { solver() } catch (error) { }
}

function updateSpot(message) {

    // Get file and path
    const filePath = path.resolve(__dirname, '../../data/spot.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const spotPrices = JSON.parse(fileData) || [];

    // Get asset from instrument name
    const asset = message.instrument_name.split("_")[0]
    const markPrice = message.mark_price

    // Update asset price
    spotPrices[asset] = markPrice;

    // Writing updated binary orderbook to live file
    fs.writeFileSync(filePath, JSON.stringify(spotPrices, null, 2), 'utf8');

    // Launch Solver
    //try { solver() } catch (error) { }
}

module.exports = { updateMarkets, updateBinaryOB, updateVanilla, updateVanillaOB, updateSpot };