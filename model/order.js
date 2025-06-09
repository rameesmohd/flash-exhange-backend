const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fund: {
      type: Schema.Types.ObjectId,
      ref: "fund",
      required: true,
    },
    usdt: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    fiat: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed", "dispute"],
      default: "pending",
    },
    bankCard: {
      accountNumber: { type: String, required: false },
      ifsc: { type: String, required: false },
      accountName: { type: String, required: false },
      upi : { type: String,required : false },
      mode : { type: String,required : true }
    },
  },
  {
    timestamps: true,
  }
);

const orderModel = mongoose.model('order', orderSchema);
module.exports = orderModel;