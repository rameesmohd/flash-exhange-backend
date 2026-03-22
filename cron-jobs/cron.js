const cron = require("node-cron");
const depositModel = require("../model/deposit");
const companyAddressesModel = require("../model/companyAddress");
const { getP2pPrices } = require("../utility/updateP2pPrices");

cron.schedule("* * * * *", () => {
  setImmediate(async () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    try {
      const expiredDeposits = await depositModel.find({
        status: "pending",
        updatedAt : { $lte: twentyMinutesAgo }
      }).select("_id recieveAddress").lean();

      if (expiredDeposits.length === 0) {
        return;
      }

      const ids = expiredDeposits.map(dep => dep._id);
      const addressIds = expiredDeposits.map(dep => dep.recieveAddress);

      const [depositResult, addressResult] = await Promise.all([
        depositModel.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "failed" } }
        ),
        companyAddressesModel.updateMany(
          { _id: { $in: addressIds } },
          { $set: { flag: false } }
        )
      ]);

    } catch (err) {
      console.error("❌ Cron error:", err);
    }
  });
}, {
  scheduled: true,
  timezone: "UTC"
});

cron.schedule('0 0,12 * * *', async () => {
  try {
    await getP2pPrices();
    // console.log('✅ getP2pPrices called successfully.');
  } catch (error) {
    console.error('❌ Error calling getP2pPrices:', error);
  }
},{
  scheduled: true,
  timezone: "UTC"
});
