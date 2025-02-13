const axios = require('axios');
const colors = require('colors');

const { settings } = require('../../config');
const { callToVanilla, filterVanillasToMatch } = require('../utils');

async function fetchVanilla() {

    try {

        const request = await axios.get('https://www.deribit.com/api/v2/public/get_instruments', {
            params: { kind: "option" },
            headers: { 'accept': 'application/json', 'content-type': 'application/json' }
        });

        const filtered = request.data.result.filter(item => {
            return settings.assets.includes(item.base_currency)
        });

        const data = callToVanilla(filtered)
        const matchingVanilla = filterVanillasToMatch(data)

        return matchingVanilla

    } catch (error) {
        console.log(colors.red("An error occured while fetching markets"));
        console.log(error)
    }
}

module.exports = {fetchVanilla}