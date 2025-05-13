const { default: axios } = require("axios");
const adminModel = require("../model/admin");

const getP2pPrices = async () => {
    try {
      // Binance P2P
      const binanceRes = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        page: 1,
        rows: 1,
        payTypes: [],
        asset: "USDT",
        fiat: "INR",
        tradeType: "SELL"
      });
  
      const binancePrice = binanceRes.data.data?.[0]?.adv?.price || null;
  
      console.log({
        success: true,
        prices: {
          binance: binancePrice
        }
      });

      const result = await adminModel.updateMany(
        {},
        {
          $set: {
            otherExchangeRates: [
              {
                binance: binancePrice,
                lastUpdated: new Date()
              },
            ],
          },
        }
      );
      console.log(result);
      return true
    } catch (error) {
      console.error(error);
      return false
    }
  }

  module.exports = {
    getP2pPrices
  }