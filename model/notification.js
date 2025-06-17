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
    capped: {
      size: 10240,  // 10 KB or adjust as needed
      max: 10,      // Max 10 messages
    },
    versionKey: false,
  }
);

module.exports = mongoose.model('notification', notificationSchema);
