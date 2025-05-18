const mongoose = require("mongoose");
const { Schema } = mongoose;

const depositSchema= new Schema({
    userId : {
        type: Schema.Types.ObjectId, 
        ref : "users",
        index: true
    },
    paymentMode : {
        type : String,
        enum : ["BEP-20","TRC-20"],
        default : "TRC-20"
    },
    status : {
        type : String,
        enum : ["pending","proccessing","success","failed","dispute"],
        default : "pending"
    },
    txid : {
        type : String,
        unique : true,
        sparse: true
    },
    amount: { 
        type: Number, 
        min  : 0,
        required: true 
    },
    transactionId : {
        type : String,
        required : true
    },
    recieveAddress  :{
        type : Schema.Types.ObjectId, 
        ref : "company-address"
    }
    }, 
    {
        timestamps: true,
    }
)

const depositModel = mongoose.model('deposits', depositSchema);
module.exports = depositModel;