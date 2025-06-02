const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Fund Schema defines the structure for fund documents
 */
const fundSchema = new Schema(
  {
    // Required Fields
    type: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMode : {
      type : String,
      enum : ["bank","upi"],
      required: true
    },

    // Optional Settings & Configuration
    maxFulfillmentTime: {
      type: Number,
      min: 1,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    transactionPass: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      default: null,
    },

    // Telegram Integration
    teleChannel: {
      type: String,
      default: null,
    },
    teleApi: {
      type: String,
      default: null,
    },

    // Status of the fund
    status: {
      type: String,
      enum: ["active", "inactive", "stockout"],
      default: "inactive",
    },
  },
  {
    timestamps: true, // createdAt & updatedAt fields
  }
);

// Export the model
module.exports = mongoose.model("fund", fundSchema);
