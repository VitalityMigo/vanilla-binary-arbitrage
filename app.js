const schedule = require('node-schedule');
const colors = require('colors');

const { updateMarkets, updateVanilla } = require('./src/manager/db');
const { streamBinary, streamVanilla, streamSpot } = require('./src/manager/ws');

async function run() {

   try {

      console.log(colors.bold('Vanilla-Options Arbitrage'))
      console.log(colors.bold('-----------------'))

      // Stream spot prices
      streamSpot()

      //  Initial fetching
      await updateMarkets()
      await updateVanilla()

      // Hourly options fetching
      schedule.scheduleJob('0 * * * *', function () {
         updateMarkets();
         updateVanilla()
      });

      // Stream options orderbooks
      streamBinary()
      streamVanilla()

   } catch (error) {
      console.log(colors.red("A global error occured: ", error))
   }
}

run()
