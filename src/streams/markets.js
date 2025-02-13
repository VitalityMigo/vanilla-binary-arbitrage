const axios = require("axios")
const colors = require("colors")

const { markToBinary, sleep, num } = require("../utils")

async function fetchMarkets() {

    const markets = []
    let offset = 0

    while (true) {

        try {

            const request = await axios.get('https://gamma-api.polymarket.com/markets', {
                params: { archived: false, active: true, closed: false, limit: "500", order: "endDate", ascending: "true", offset: offset },
                headers: { 'accept': 'application/json', 'content-type': 'application/json' }
            });

            const data = markToBinary(request.data)
            markets.push(...data)


            if (request.data.length < 500) { break }
            offset += 500

            await sleep(2)

        } catch (error) {
            console.log(colors.red("An error occured while fetching markets"));
            console.log(error)
        }
    }

    return markets
}

async function fetchBinaryOB(clobYes, clobNo) {

    // Settings
    const endpoint = 'https://clob.polymarket.com/books'
    const requestBody = [{ token_id: clobYes }, { token_id: clobNo }];
    const capturedSpread = 0.5

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        // Raw orderbook data
        const orderbooks = await response.json();
        const yesOB = orderbooks.find(i => i.asset_id === clobYes);
        const noOB = orderbooks.find(i => i.asset_id === clobNo);

        // Anchor figures (BBO and mark price)
        const BBOYes = { bid: num(yesOB.bids[yesOB.bids.length - 1].price), ask: num(yesOB.asks[yesOB.asks.length - 1].price) }
        const BBONo = { bid: num(noOB.bids[noOB.bids.length - 1].price), ask: num(noOB.asks[noOB.asks.length - 1].price) }
        const markPriceYes = (BBOYes.bid + BBOYes.ask) / 2
        const markPriceNo = (BBONo.bid + BBONo.ask) / 2


        const result = {
            yes: {
                mark: markPriceYes,
                spread: BBOYes.ask - BBOYes.bid,
                book: {
                    bids: yesOB.bids.filter(i => i.price > markPriceYes * (1 - capturedSpread)).map(item => ({ price: parseFloat(item.price), size: parseFloat(item.size) })),
                    asks: yesOB.asks.filter(i => i.price < markPriceYes * (1 + capturedSpread)).map(item => ({ price: parseFloat(item.price), size: parseFloat(item.size) })),
                }
            },
            no: {
                mark: markPriceNo,
                spread: BBONo.ask - BBONo.bid,
                book: {
                    bids: noOB.bids.filter(i => i.price > markPriceNo * (1 - capturedSpread)).map(item => ({ price: parseFloat(item.price), size: parseFloat(item.size) })),
                    asks: noOB.asks.filter(i => i.price < markPriceNo * (1 + capturedSpread)).map(item => ({ price: parseFloat(item.price), size: parseFloat(item.size) })),
                }
            }
        }

        return result

    } catch (error) {
        console.error("Error fetching order books:", error.stack);
    }
}

module.exports = { fetchMarkets, fetchBinaryOB }