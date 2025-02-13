const colors = require('colors')

const { getOptionsDB, matchVantoBin, relevantBinary, getBBO, getSpot } = require('../utils');
const { arbCondition, binarySizing } = require('./condition');
const { IV76, black76Delta } = require('./pricing');
const logArbitrage = require('../manager/log');
const { settings } = require('../../config')

function solver() {

    // Files 
    const files = getOptionsDB();
    const { vanillaOptions, polyOptions, vanillaOB, binaryOB, spot } = files

    // Filter binary options by direction
    const binaryOptions = relevantBinary(polyOptions)

    // Run through binary options
    for (const B of binaryOptions) {

        // Global settings
        const asset = B.asset
        const spot = getSpot(asset)
        const expiry = B.expiry

        // Extract settings and orderbook
        const DIR_B = B.direction
        const K_B = B.strike
        const P_B = getBBO('binary', B.instrument).ask

        // If no binary ask price, continue
        if (!P_B) { continue }

        // Find matching vanilla options
        const matchingVanilla = matchVantoBin(vanillaOptions, B)

        for (const V of matchingVanilla) {

            // Extract settings and orderbook
            const DIR_V = V.direction
            const K_V = V.strike
            const Q_V = 1 // Default quantity
            const P_V = getBBO('vanilla', V.instrument).ask * spot

            // If no vanilla ask price, continue
            if (!P_V) { continue }

            // Calculate data including P_V
            const F = Math.min(spot * settings.fees, P_V * settings.max_fees)
            const Q_B = binarySizing(Q_V, P_V, P_B, F)

            // Verify arbitrage condition
            const arbitrage = arbCondition(DIR_V, Q_B, K_B, P_B, Q_V, K_V, P_V, F)

            if (arbitrage) {

                // Gathering additional data
                const IV_V = IV76(spot, K_V, expiry, settings.rfr, P_V, DIR_V)
                const DELTA_V = black76Delta(spot, K_V, expiry, settings.rfr, IV_V, DIR_V)

                const trade = {
                    date: (new Date()).toISOString(),
                    asset: asset,
                    expiry: expiry,
                    direction: DIR_V,
                    vanilla: {
                        instrument: V.instrument,
                        direction: DIR_V,
                        strike: K_V,
                        price: P_V,
                        quantity: Q_V,
                        delta: DELTA_V,
                    },
                    binary: {
                        instrument: B.instrument,
                        direction: DIR_B,
                        strike: K_B,
                        price: P_B,
                        quantity: Q_B,
                    },
                }

                // Call DB writer
                logArbitrage(trade)

                // Logs
                console.log(colors.green("Arbitrage Detected"))
                console.log(colors.grey("Date:", trade.date, '| Asset:', trade.asset, '| Direction:', trade.direction))
                console.table(trade.vanilla)
                console.table(trade.binary)
            } else {
                continue
            }
        }
    }
}

module.exports = solver

