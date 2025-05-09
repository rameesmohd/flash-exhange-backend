const mongoose = require("mongoose");
const { Schema } = mongoose;

const bankCardSchema= new Schema({
    userId : {
        type: Schema.Types.ObjectId, 
        ref : "users"
    },
    accountNumber : {
        type: String,
        required: true
    },
    ifsc : {
        type : String,
        required: true
    },
    accountName  :{
        type : String,
        required: true
    },
    }, 
    {
        timestamps: true,
    }
)

const bankCardModel = mongoose.model('bankcard', bankCardSchema);
module.exports = bankCardModel;