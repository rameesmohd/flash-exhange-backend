const fundModel = require('../model/fund')
const orderModel = require('../model/order')
const bankCardModel = require('../model/bankCard')
const userModel = require('../model/user')
const generateSixDigitId = require('../utility/generateSixDigitId')
const mongoose = require('mongoose');
const { getP2pPrices } = require('../utility/updateP2pPrices')
const adminModel = require('../model/admin')
const { validateTransPass } = require('./userController')

const fetchFunds=async(req,res)=>{
    try {   
        const funds = await fundModel.find({})
        const otherExchangeRates = await adminModel.findOne({},{otherExchangeRates:1})
        
        return res.status(200).json({success: true, funds:funds ,otherExchangeRates: otherExchangeRates.otherExchangeRates})
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

// const createOrder=async(req,res)=>{
//     try {
        
//         const validation = await validateTransPass(req);
//         if (!validation.success) {
//             return res.status(validation.status).json({ success: false, message: validation.message });
//         }

//         const { usdt,fiat,fund,bankCard }=req.body
//         const user = req.user
        
//         if(user.availableBalance<usdt){
//             return res.status(400).json({ success: false, message: "Insufficient balance" });
//         }

//         const isFundValid = await fundModel.findOne({_id : fund._id,status : "active"})
//         if ( 
//             !isFundValid || 
//             fund.rate !== isFundValid.rate ||
//             Math.abs(fiat / isFundValid.rate - usdt) > 0.01
//         ) {
//             return res.status(400).json({ success: false, message: "Fund not available" });
//         }

//         const isBankCardExist=await bankCardModel.findOne({_id: bankCard._id})
//         if(!isBankCardExist){
//             return res.status(400).json({ success: false, message: "Invalid bank card" });
//         }

//         const orderId = await generateUniqueWithdrawTransactionId()
//         const newOrder = new orderModel({
//             userId : user._id,
//             fund : isFundValid._id,
//             usdt,
//             fiat,
//             orderId,
//             bankCard : {
//                 accountNumber : isBankCardExist.accountNumber,
//                 accountName : isBankCardExist.accountName,
//                 ifsc : isBankCardExist.ifsc
//             }
//         })
//         console.log(user);
        
//         const processing = user.processing + Number(usdt);
//         const availableBalance = user.availableBalance-Number(usdt);
//         const totalBalance = availableBalance+processing
//         const updatedUser = await userModel.findOneAndUpdate(
//             { _id: user._id },
//             {
//               $set: {
//                 totalBalance,
//                 processing,
//                 availableBalance
//               }
//             },
//             {
//               new: true // returns the updated document
//             }
//         );
//         await newOrder.save()
//         return res.status(200).json({success: true,message:"Order created successfully",user : updatedUser})
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({success : false,message : "Server error"})
//     }
// }

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const validation = await validateTransPass(req);
    if (!validation.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const { usdt, fiat, fund, bankCard } = req.body;
    const user = req.user;

    if (user.availableBalance < usdt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    const isFundValid = await fundModel.findOne({ _id: fund._id, status: "active" }).session(session);
    if (
      !isFundValid ||
      fund.rate !== isFundValid.rate ||
      Math.abs(fiat / isFundValid.rate - usdt) > 0.01
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Fund not available" });
    }

    const isBankCardExist = await bankCardModel.findOne({ _id: bankCard._id }).session(session);
    if (!isBankCardExist) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid bank card" });
    }

    const orderId = await generateUniqueWithdrawTransactionId();
    const newOrder = new orderModel({
      userId: user._id,
      fund: isFundValid._id,
      usdt,
      fiat,
      orderId,
      bankCard: {
        accountNumber: isBankCardExist.accountNumber,
        accountName: isBankCardExist.accountName,
        ifsc: isBankCardExist.ifsc,
      },
    });

    const processing = user.processing + Number(usdt);
    const availableBalance = user.availableBalance - Number(usdt);
    const totalBalance = availableBalance + processing;

    const updatedUser = await userModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          totalBalance,
          processing,
          availableBalance,
        },
      },
      { new: true, session }
    );

    await newOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      user: updatedUser,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("createOrder error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

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