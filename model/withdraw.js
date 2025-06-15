const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawSchema = new Schema(
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
    receiveAddress: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed", "dispute"],
      default: "pending",
      required: true,
      index: true 
    },
    txid: {
      type: String,
      index:true,
      sparse: true,
      trim: true,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      set: val => parseFloat(val.toFixed(2)),
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const withdrawModel = mongoose.model("withdraw", withdrawSchema);
module.exports = withdrawModel;
