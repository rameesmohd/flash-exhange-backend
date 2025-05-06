const mongoose = require("mongoose");
const { Schema } = mongoose;

const depositSchema= new Schema({
    userId : {
        type: Schema.Types.ObjectId, 
        ref : "users"
    },
    paymentMode : {
        type : String,
        enum : ["BEP-20","TRC-20"],
        default : "TRC-20"
    },
    status : {
        type : String,
        enum : ["pending","proccessing","success","failed"],
        default : "pending"
    },
    txid : {
        type : String
    },
    amount: { 
        type: Number, 
        min  : 0,
        required: true 
    },
    transactionId : {
        type : String,
        required : true
    }
}, 
    {
        timestamps: true,
    }
)

const depositModel = mongoose.model('deposits', depositSchema);
module.exports = depositModel;