const mongoose = require("mongoose");
const { Schema } = mongoose;


const userSchema= new Schema({
    email : {
        type : String,
        unique : true,
        index : true,
        required : true
    },
    phone : {
        type : String,
        unique : true,
        index : true,
        required : true
    },
    currentToken: { 
        type: String 
    }, // Token Version
}, 
    {
        timestamps: true,
    }
)

const userModel = mongoose.model('user', userSchema);
module.exports = userModel;