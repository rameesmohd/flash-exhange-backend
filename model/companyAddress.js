const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    network: {
      type: String,
      default: 'TRC-20',
      enum: ['TRC-20', 'ERC-20', 'BEP-20'], 
    },
    flag: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    priority: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const companyAddressesModel = mongoose.model('companyaddress', addressSchema);
module.exports = companyAddressesModel;