const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // Optional: expire after 1 day if you use a non-capped collection
    },
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
