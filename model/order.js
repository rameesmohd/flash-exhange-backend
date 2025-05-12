const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema= new Schema({
    userId : {
        type: Schema.Types.ObjectId, 
        ref : "users",
        index: true
    },
    orderId :{
        type : String,
        unique : true,
        index : true,
        required: true
    },
    fund : {
        type: Schema.Types.ObjectId, 
        ref : "fund"
    },
    usdt : {
        type : Number,
        required: true
    },
    fiat  :{
        type : Number,
        required :true
    },
    status : {
        type : String,
        enum : ["pending","proccessing","success","failed","dispute"],
        default : "pending"
    },
    bankCard : {
        accountNumber : {
            type : String,
            required: true
        },
        ifsc : {
            type : String,
            required: true
        },
        accountName :{
            type :String,
            required: true
        }
    }
    }, 
    {
        timestamps: true,
    }
)

const orderModel = mongoose.model('order', orderSchema);
module.exports = orderModel;