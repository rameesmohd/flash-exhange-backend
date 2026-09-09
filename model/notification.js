const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    versionKey: false,
  }
);

// Auto-delete notifications older than 7 days
notificationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('notification', notificationSchema);
