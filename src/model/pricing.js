const { erf } = require('mathjs');
const { timeToExpiry } = require('../utils')

function cumulativeNormalDistribution(x) {
    return (1 + erf(x / Math.sqrt(2))) / 2;
}

function normalDensity(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function black76Price(F, K, T, r, sigma, optionType) {
    const d1 = (Math.log(F / K) + (sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const N_d1 = cumulativeNormalDistribution(d1);
    const N_d2 = cumulativeNormalDistribution(d2);

    if (optionType === 'Call') {
        return Math.exp(-r * T) * (F * N_d1 - K * N_d2);
    } else if (optionType === 'Put') {
        return Math.exp(-r * T) * (K * cumulativeNormalDistribution(-d2) - F * cumulativeNormalDistribution(-d1));
    } else {
        throw new Error('Invalid option type. Use "call" or "put".');
    }
}

function IV76(F, K, expiry, r, marketPrice, optionType, initialGuess = 0.2) {
    const tolerance = 1e-5;
    const maxIterations = 500;
    let sigma = initialGuess;

    const T = timeToExpiry(expiry);

    for (let i = 0; i < maxIterations; i++) {
        const price = black76Price(F, K, T, r, sigma, optionType);
        const d1 = (Math.log(F / K) + (sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        const vega = F * Math.exp(-r * T) * Math.sqrt(T) * normalDensity(d1);

        const priceDifference = price - marketPrice;

        if (Math.abs(priceDifference) < tolerance) {
            return sigma;
        }

        sigma -= priceDifference / vega;
    }

    return IV76Bissection(F, K, T, r, marketPrice, optionType)
}

function IV76Bissection(F, K, T, r, marketPrice, optionType, lowerBound = 0.001, upperBound = 100, tolerance = 1e-4, maxIterations = 1000) {
    let lowerSigma = lowerBound;
    let upperSigma = upperBound;
    let sigma = (lowerSigma + upperSigma) / 2;

    for (let i = 0; i < maxIterations; i++) {
        const price = black76Price(F, K, T, r, sigma, optionType);
        const priceDifference = price - marketPrice;

        if (Math.abs(priceDifference) < tolerance) {
            return sigma;
        }

        if (priceDifference > 0) {
            upperSigma = sigma;
        } else {
            lowerSigma = sigma;
        }
        sigma = (lowerSigma + upperSigma) / 2;
    }

    return null;
}

function black76Delta(F, K, expiry, r, sigma, optionType) {
    try {
        const T = timeToExpiry(expiry);
        const d1 = (Math.log(F / K) + (sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        const N_d1 = cumulativeNormalDistribution(d1);

        if (optionType === 'Call') {
            return Math.exp(-r * T) * N_d1;
        } else if (optionType === 'Put') {
            return -Math.exp(-r * T) * cumulativeNormalDistribution(-d1);
        } else {
            throw new Error('Invalid option type. Use "call" or "put".');
        }
    } catch (error) {
        return null
    }
}

module.exports = { IV76, black76Delta };