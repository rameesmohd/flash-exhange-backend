const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema= new Schema({
    userId : {
        type: Schema.Types.ObjectId, 
        ref : "users",
        index: true
    },
    address : {
        type : String,
        index : true,
        required :true,
    },
    network : {
        type : String,
        enum : ["BEP-20","TRC-20"],
        default : "TRC-20"
    },
    isSelected : {
        type : Boolean,
        default : false
    }
    }, 
    {
        timestamps: true,
    }
)

const addressModel = mongoose.model('address', addressSchema);
module.exports = addressModel;