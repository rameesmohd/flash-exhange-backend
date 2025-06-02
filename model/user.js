const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    transactionPin: {
      type: String,
      default: null,
    },
    totalBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    processing: {
      type: Number,
      default: 0,
      min: 0,
    },
    disputeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    referrer: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
    },
    totalReferralCommission: {
      type: Number,
      default: 0,
    },
    totalReferrals: {
      levelOne: { type: Number, default: 0 },
      levelTwo: { type: Number, default: 0 },
    },
    currentToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


const userModel = mongoose.model('users', userSchema);
module.exports = userModel;