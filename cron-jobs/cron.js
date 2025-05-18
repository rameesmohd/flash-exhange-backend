const cron = require("node-cron");
const depositModel = require("../model/deposit"); // adjust path as needed
const companyAddressesModel = require("../model/companyAddress"); // adjust path as needed

// Runs every minute
cron.schedule("* * * * *", async () => {
  console.log("CRON: Checking for expired deposits...");
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

  try {
    // Find expired pending deposits
    const expiredDeposits = await depositModel.find({
      status: "pending",
      createdAt: { $lte: twentyMinutesAgo }
    });

    if (expiredDeposits.length === 0) return;

    // Update their status to "failed"
    const ids = expiredDeposits.map(dep => dep._id);
    await depositModel.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "failed" } }
    );

    // Unlock associated addresses
    const addressIds = expiredDeposits.map(dep => dep.recieveAddress);
    await companyAddressesModel.updateMany(
      { _id: { $in: addressIds } },
      { $set: { flag: false } }
    );

    console.log(`Marked ${expiredDeposits.length} deposits as failed and unlocked their addresses.`);
  } catch (err) {
    console.error("Cron error:", err);
  }
});
