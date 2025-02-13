const path = require('path');
const fs = require('fs');

function logArbitrage(data) {

    const filePath = path.resolve(__dirname, '../../data/arbitrage/historical.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const arbitrageData = JSON.parse(fileData) || [];

    arbitrageData.push(data);

    fs.writeFileSync(filePath, JSON.stringify(arbitrageData, null, 2), 'utf8');
}

module.exports = logArbitrage