const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema= new Schema({
        address : {
            type : String,
            index : true,
            required :true,
        },
        network : {
            type : String,
            default : "TRC-20"
        },
        flag : {
            type : Boolean,
            default : false
        },
        status : {
            type  : String,
            enum : ["active","inactive"],
            default : "active"
        },
        priority : {
            type : Number,
        }
    }, 
    {
        timestamps: true,
    }
)

const companyAddressesModel = mongoose.model('company-address', addressSchema);
module.exports = companyAddressesModel;