const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utility/cryptoUtils');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  address: String,
  encryptedPrivateKey: { type: String, required: true },
}, {
  timestamps: true
});

// Virtual field for decrypted access (only used in backend/admin)
walletSchema.virtual('privateKey')
  .get(function () {
    return decrypt(this.encryptedPrivateKey);
  })
  .set(function (val) {
    this.encryptedPrivateKey = encrypt(val);
  });

const walletModel = mongoose.model('wallet', walletSchema);
module.exports = walletModel