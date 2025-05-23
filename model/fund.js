const mongoose = require("mongoose");
const { Schema } = mongoose;

const fundSchema= new Schema({
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
    status: {
      type: String,
      enum: ["active", "unavailable", "stockout"],
      default: "active",
    },
    maxFulfillmentTime: {
        type: Number,
        required: false,
        min: 1,
    },
    availableStock: {
      type: Number,
      required: false,
      min: 0,
    },
    fundAdmin: {
      type: String,
      required: false,
      trim: true,
    }
    }, 
    {
        timestamps: true,
    }
)

const fundModel = mongoose.model('fund', fundSchema);
module.exports = fundModel;