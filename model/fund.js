const mongoose = require("mongoose");
const { Schema } = mongoose;

const fundSchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ["bank", "upi"], required: true },

    // ── New: Fund category drives which receipt template is used ──
    fundType: {
      type: String,
      enum: ["gateway", "clean", "bank"],
      required: true,
      default: "gateway",
    },

    // ── New: Short code printed on receipts e.g. GW01, BT01, CF01 ──
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,         // no two funds can share a code
    },

    // ── New: Whitelist. Empty array = visible to ALL users.
    //         Non-empty = only these emails can see/use this fund. ──
    allowedUsers: {
      type: [String],
      default: [],
    },

    maxFulfillmentTime: { type: Number, min: 1, default: null },
    password:           { type: String, default: null },
    transactionPass:    { type: String, default: null },
    message:            { type: String, default: null },
    teleChannel:        { type: String, default: null },
    teleApi:            { type: String, default: null },

    status: {
      type: String,
      enum: ["active", "inactive", "stockout"],
      default: "inactive",
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("fund", fundSchema);