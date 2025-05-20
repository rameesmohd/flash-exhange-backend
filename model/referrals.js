const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralSchema = new Schema({
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  referee: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  referredVia: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null
    // Level 2 referral structure:
    // {
    //   referredBy: A (grandparent),
    //   referee: C (new user),
    //   referredVia: B (parent),
    //   level: "Level 2"
    // }
    // Now A knows C came from B.
  },
  totalCommission: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    enum: ["Level 1", "Level 2"],
    required: true
  }
}, {
  timestamps: true
});

// Optional: add index for better query performance
referralSchema.index({ referredBy: 1 });
referralSchema.index({ referee: 1 });

const referralModel = mongoose.model('referral', referralSchema);
module.exports = referralModel;

