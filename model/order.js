const mongoose = require("mongoose");
const { Schema } = mongoose;
const roundTo2 = (num) => Math.round(num * 100) / 100;

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
      trim: true,
    },
    fund: {
      type: Schema.Types.ObjectId,
      ref: "fund",
      required: true,
    },
    usdt: {
      type: Number,
      required: true,
      min: 0.01,
    },
    fiat: {
      type: Number,
      required: true,
      min: 0.01,
    },
    fulfilledFiat: {
      type: Number,
      default: 0,
      min: 0,
    },
    fulfilledRatio: {
      type: Number,
      default: 0, // auto-calculate: fulfilledFiat / fiat
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed", "dispute"],
      default: "pending",
    },
    receipts: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every(url => typeof url === 'string'),
        message: 'Receipts must be an array of URLs',
      },
    },
    bankCard: {
      accountNumber: { 
        type: String, 
        required: false,
        trim: true,
      },
      ifsc: { 
        type: String, 
        required: false,
         trim: true,
      },
      accountName: { 
        type: String, 
        required: false,
         trim: true, 
      },
      upi : { 
        type: String,
        lowercase: true,
        required : false,
        trim: true, 
      },
      mode : { 
        type: String,
        required : true,
        enum: ["bank","upi"],
        trim: true,
      }
    },
  },
  {
    timestamps: true,
  }
);

// Ensure 2 decimal precision for fulfilledFiat and fulfilledRatio
orderSchema.pre("save", function (next) {
  if (typeof this.fulfilledFiat === 'number') {
    this.fulfilledFiat = roundTo2(this.fulfilledFiat);
  }

  if (typeof this.fiat === 'number' && this.fiat > 0) {
    this.fulfilledRatio = roundTo2(Math.min(this.fulfilledFiat / this.fiat, 1));
  } else {
    this.fulfilledRatio = 0;
  }

  next();
});

const orderModel = mongoose.model('order', orderSchema);
module.exports = orderModel;