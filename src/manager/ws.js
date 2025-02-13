const { websocket } = require("../../config");
const { getClobIds, getVanillaNames, getSpotNames } = require('../utils');

const vanillaWS = require("../streams/vanilla");
const binaryWS = require('../streams/binary');
const spotWS = require('../streams/spot');

let BinaryWSManager;
let VanillaWSManager;
let SpotWSManager;

function streamBinary() {
    // Init. stream binary orderbook
    const clobIds = getClobIds()
    BinaryWSManager = new binaryWS(websocket.polymarket);
    BinaryWSManager.start(clobIds);
}

function streamVanilla() {
    const instrumentNames = getVanillaNames()
    VanillaWSManager = new vanillaWS(websocket.deribit);
    VanillaWSManager.start(instrumentNames);
}

function streamSpot() {
    const instrumentNames = getSpotNames()
    SpotWSManager = new spotWS(websocket.deribit);
    SpotWSManager.start(instrumentNames);
}

module.exports = { streamBinary, streamVanilla, streamSpot, BinaryWSManager, VanillaWSManager, SpotWSManager }