# Vanilla-Binary Options Arbitrage Strategy

This project is the support for a paper entitled [Derivatives Arbitrage Strategies in Cryptocurrency Markets](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5117697), available on the Social Science Research Network. For further context, please refer to the latter.

## Context

Vanilla and prediction markets binary options are commonly used derivatives in crypto markets. Combining these two instruments can sometimes create unique arbitrage opportunities by exploiting relative misspricing. The purpose of this project is to provide a method for identifying these opportunities, as presented in the above-mentioned paper.

## Components

### Streaming

The project uses real-time data streams (100ms) to obtain orderbooks for options and underlying assets. The streaming components include:

- **Spot Prices Streaming**: Uses the [`spotWS`](src/streams/spot.js) class to connect to spot price streams of underlying assets.
- **Binary Options Orderbook Streaming**: Uses the [`binaryWs`](src/streams/binary.js) class to connect to orderbook streams of binary options.
- **Vanilla Options Orderbook Streaming**: Uses the [`vanillaWS`](src/streams/vanilla.js) class to connect to orderbook streams of vanilla options.

### Model

The arbitrage model is implemented in the [`solver.js`](src/model/solver.js) file. It uses pricing and condition functions to identify arbitrage opportunities:

- **Pricing**: Pricing functions, such as [`black76Price`](src/model/pricing.js), calculate theoretical option prices and greeks using the Black-76 model.
- **Arbitrage Condition**: Arbitrage condition as derived in the paper, such as [`arbCondition`](src/model/condition.js), check if arbitrage conditions are met.

### Data Management

Market and orderbook data are managed by the [`db.js`](src/manager/db.js) module. This module updates JSON files containing information about instruments and orderbooks.


## Methodology

The overall methodology of the project is as follows:

1. **Initialization**: Data streams for spot prices, binary options, and vanilla options are initialized (100ms).
2. **Market Updates**: Instruments information is periodically updated, default to every hours.
3. **Arbitrage Detection**: The arbitrage model analyzes real-time data to detect arbitrage opportunities.
4. **Transaction Logging**: Detected arbitrage situations are logged for further analysis.


## Installation and Usage

To install this project, follow the steps below:

1. Clone the repository:
   ```sh
   git clone <REPOSITORY_URL>
   cd <REPOSITORY_NAME>
   ```

2. Install the dependencies:
   ```sh
   npm install
   ```

To run the project, use the following command [`app.js`](app.js). This script will initialize data streams, update market information, and start detecting real-time arbitrage opportunities.

## Contact

For any questions, please contact me through the email address associated to my SSRN [profile](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=6620162). 