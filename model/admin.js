const mongoose = require("mongoose");
const { Schema } = mongoose;

const adminSchema= new Schema({
    email : {
        type: String, 
        required : true
    },
    password : {
        type : String,
        required : true
    },
    totalDeposits : {
        type : Number,
        required: true,
        default : 0
    },
    totalWithdrawals : {
        type : Number,
        required: true,
        default : 0
    },
    currentBalance :{
        type : Number,
        default : 0
    },
    totalCompletedOrders :{
        type : Number,
        default : 0
    },
    totalCompletedOrdersAmount :{
        type : Number,
        default : 0
    },
    totalFundsInOrder: {
        type : Number,
        default :0
    },
    mainAddress : {
        type : String
    },
    networkFee : {
        type: Number
    },
    otherExchangeRates: [
        {
          binance: {
            type: String,
          },
          lastUpdated: {
            type: Date,
            default: Date.now,
          },
        },
    ],
    }, 
    {
        timestamps: true,
    }
)

const adminModel = mongoose.model('admin', adminSchema);
module.exports = adminModel;