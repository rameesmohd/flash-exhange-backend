const { default: axios } = require("axios");
const adminModel = require("../model/admin");

const getP2pPrices = async () => {
    try {
     const binanceRes = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        page: 1,
        rows: 1,
        payTypes: ['UPI'],    
        asset: 'USDT',
        fiat: 'INR',
        tradeType: 'SELL'
      });

      const binancePrice = parseFloat(binanceRes.data.data?.[0]?.adv?.price-5 || "0");
      
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

    getP2pPrices()


  module.exports = {
    getP2pPrices
  }