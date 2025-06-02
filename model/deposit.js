const mongoose = require("mongoose");
const { Schema } = mongoose;

const depositSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ["BEP-20", "TRC-20"],
      default: "TRC-20",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed", "dispute"],
      default: "pending",
      required: true,
    },
    txid: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      trim: true,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      set: val => parseFloat(val.toFixed(2)), // ensure two decimal precision
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
    },
    recieveAddress: {
      type: Schema.Types.ObjectId,
      ref: "company-address",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const depositModel = mongoose.model("deposits", depositSchema);
module.exports = depositModel;
