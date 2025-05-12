const fundModel = require('../model/fund')
const orderModel = require('../model/order')
const bankCardModel = require('../model/bankCard')
const userModel = require('../model/user')
const generateSixDigitId = require('../utility/generateSixDigitId')

const fetchFunds=async(req,res)=>{
    try {   
        const funds = await fundModel.find({})
        return res.status(200).json({success: true, funds:funds[0]})
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}

const generateUniqueWithdrawTransactionId = async () => {
    let unique = false;
    let transactionId = '';
    
    while (!unique) {
        transactionId = generateSixDigitId();
        const existing = await orderModel.findOne({ transactionId });
    
        if (!existing) {
            unique = true;
        }
    }
    
    return transactionId;
};

const createOrder=async(req,res)=>{
    try {
        const { usdt,fiat,fund,bankCard }=req.body
        const user = req.user
        
        const isFundValid = await fundModel.findOne({_id : fund._id,status : "active"})
        if ( 
            !isFundValid || 
            fund.rate !== isFundValid.rate ||
            Math.abs(fiat / isFundValid.rate - usdt) > 0.01
        ) {
            return res.status(400).json({ success: false, message: "Fund not available" });
        }

        const isBankCardExist=await bankCardModel.findOne({_id: bankCard._id})
        if(!isBankCardExist){
            return res.status(400).json({ success: false, message: "Invalid bank card" });
        }

        const orderId = await generateUniqueWithdrawTransactionId()
        const newOrder = new orderModel({
            userId : user._id,
            usdt,
            fiat,
            orderId,
            bankCard : {
                accountNumber : isBankCardExist.accountNumber,
                accountName : isBankCardExist.accountName,
                ifsc : isBankCardExist.ifsc
            }
        })

        const processing = user.processing+usdt;
        const available = user.totalBalance-processing;
        await userModel.updateOne({_id : user._id},{$set:{processing,availableBalance:available}})
        await newOrder.save()
        return res.status(200).json({success: true,message:"Order created successfully"})
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}

const fetchOrders=async(req,res)=>{
    try {
        const user = req.user
        const orders = await orderModel.find({userId : user._id})
        res.status(200).json({success: true,orders})
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}

module.exports = {
    fetchFunds,
    createOrder,
    fetchOrders
}