const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralSchema= new Schema({
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required : true
    },
    referee: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required : true

    },
    totalCommission : {
        type : Number,
        default : 0
    },
    level : {
        type : String,
        enum : ["Level 1","Level 2"],
        required : true
    }
}, 
    {
        timestamps: true,
    }
)

// Optional: add index for better query performance
referralSchema.index({ referredBy: 1 });
referralSchema.index({ referee: 1 });

const referralModel = mongoose.model('referral', referralSchema);
module.exports = referralModel;