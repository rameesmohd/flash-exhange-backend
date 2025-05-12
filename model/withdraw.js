const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawSchema= new Schema({
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
    recieveAddress : {
        type : String,
        require : true
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
        index : true,
        required : true
    }
    }, 
    {
        timestamps: true,
    }
)

const withdrawModel = mongoose.model('withdraw', withdrawSchema);
module.exports = withdrawModel;