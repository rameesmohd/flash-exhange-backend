const mongoose = require("mongoose");
const { Schema } = mongoose;

const bankCardSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["bank", "upi"],
      required: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      default: null,
    },
    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    accountName: {
      type: String,
      trim: true,
      default: null,
    },
    upi: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Validation middleware to ensure required fields are provided based on mode
bankCardSchema.pre("save", function (next) {
  if (this.mode === "bank") {
    if (!this.accountNumber || !this.ifsc || !this.accountName) {
      return next(new Error("Bank details are required when mode is 'bank'."));
    }
    this.upi = null;
  }

  if (this.mode === "upi") {
    if (!this.upi) {
      return next(new Error("UPI ID is required when mode is 'upi'."));
    }
    this.accountNumber = this.ifsc = this.accountName = null;
  }

  next();
});

const bankCardModel = mongoose.model("bankcard", bankCardSchema);
module.exports = bankCardModel;
