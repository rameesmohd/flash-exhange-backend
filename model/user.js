const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema= new Schema({
    email: {
        type : String,
        unique : true,
        index : true,
        required : true
    },
    phone: {
        type : String,
        unique : true,
        index : true,
        required : true
    },
    transactionPass : {
        type : String
    },
    totalBalance: {
        type : Number,
        default : 0,
        min: 0
    },
    availableBalance: {
        type : Number,
        default : 0,
        min: 0
    },
    processing: {
        type  : Number,
        default : 0,
        min: 0
    },
    disputeAmount  :{
        type : Number,
        default  :0,
        min: 0
    },
    currentToken: { 
        type: String 
    }, // Token Version
}, 
    {
        timestamps: true,
    }
)

const userModel = mongoose.model('users', userSchema);
module.exports = userModel;