const mongoose = require("mongoose");
const { Schema } = mongoose;

const fundSchema= new Schema({
    type : {
        type :String,
        required: true
    },
    rate : {
        type : Number,
        required : true
    },
    status : {
        type : String,
        enum : ["active","unavailable","stockout"],
        default : "active"
    },
    maxFullfillmentTime : {
        type: String,
        required : false
    },
    availableStock : {
        type : Number,
        required : false
    },
    fundAdmin : {
        type : String,
        required :false
    }
    }, 
    {
        timestamps: true,
    }
)

const fundModel = mongoose.model('fund', fundSchema);
module.exports = fundModel;