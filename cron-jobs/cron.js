const cron = require("node-cron");
const depositModel = require("../model/deposit");
const companyAddressesModel = require("../model/companyAddress");

cron.schedule("* * * * *", () => {
  setImmediate(async () => {
    // console.log("CRON: Checking for expired deposits...");

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    try {
      const expiredDeposits = await depositModel.find({
        status: "pending",
        createdAt: { $lte: twentyMinutesAgo }
      }).select("_id recieveAddress").lean();; // only fetch what you need

      if (expiredDeposits.length === 0) {
        console.log("❌Zero expired deposits")
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

      console.log(`✅ Marked ${ids.length} deposits as failed and unlocked addresses.`);
    } catch (err) {
      console.error("❌ Cron error:", err.message);
    }
  });
}, {
  scheduled: true,
  timezone: "UTC"
});