const fundModel = require('../../model/fund')
const orderModel = require('../../model/order')
const bankCardModel = require('../../model/bankCard')
const userModel = require('../../model/user')
const generateSixDigitId = require('../../utility/generateSixDigitId')
const mongoose = require('mongoose');
const { getP2pPrices } = require('../../utility/updateP2pPrices')
const adminModel = require('../../model/admin')
const { validateTransPass } = require('./userController')
const { default: axios } = require('axios')

const fetchFunds=async(req,res)=>{
    try {   
        const funds = await fundModel.find({status : "active"})
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

const sentBankOrderMessage = async (order,fund) => {
      console.log(order,fund);

      if(!fund.teleApi || !fund.teleChannel) return 

      // const caption =`*✅ USDT Sale Order Placed:*\n\n💰USDT: $${order.usdt}\n👨‍💻OrderId: ${order.orderId}\nBank Account: ${order.bankCard.accountNumber}\nIFSC: ${order.bankCard.ifsc}\nName: ${order.bankCard.accountName}`;

      const caption = 
      "```\n" +
      "✅ USDT Sale Order Placed\n" +
      "----------------------------\n" +
      "💵 INR     : "+ order.fiat + "\n" +
      "💵 USDT     : "+ order.usdt + "\n" +
      "🆔 Order ID   : " + order.orderId + "\n" +
      "🏦 Bank Info\n" +
      "   Name       : " + order.bankCard.accountName + "\n" +
      "   Account No : " + order.bankCard.accountNumber + "\n" +
      "   IFSC       : " + order.bankCard.ifsc + "\n" +
      "```";

      const url = `https://api.telegram.org/bot${fund.teleApi}/sendMessage`;
      
      const params = {
        chat_id: fund.teleChannel,
        text: caption,
        parse_mode: 'MarkdownV2',
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              // {
              //   text: 'Approve',
              //   url: 'https://discord.gg/',
              // },
              //  {
              //   text: 'Reject',
              //   url: 'https://discord.gg/',
              // }
            ], 
          ],
        }),
      };
    
      try {
        await axios.post(url, params);
      } catch (error) {
        console.error(error);
      }
      return 
}

const QRCode = require('qrcode');
const FormData = require('form-data'); // Correct FormData for Node.js

const sentUpiOrderMessage = async (order, fund) => {
  console.log(order, fund);

  if (!fund.teleApi || !fund.teleChannel) return;

  const caption =
    "```\n" +
    "✅ USDT Sale Order Placed\n" +
    "----------------------------\n" +
    "💵 Amount     : $" + order.usdt + "\n" +
    "🆔 Order ID   : " + order.orderId + "\n" +
    "🏦 UPI Info\n" +
    "   UPI       : " + order.bankCard.upi + "\n" +
    "```";

  try {
    // 1. Generate UPI QR code
    const upiUrl = `upi://pay?pa=${order.bankCard.upi}&pn=${encodeURIComponent(order.bankCard.accountName)}`;
    const qrDataUrl = await QRCode.toDataURL(upiUrl);

    // 2. Convert base64 image to buffer
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 3. Prepare form-data
    const formData = new FormData();
    formData.append('chat_id', fund.teleChannel);
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    formData.append('photo', imageBuffer, {
      filename: 'upi_qr.png',
      contentType: 'image/png'
    });
    formData.append('reply_markup', JSON.stringify({
      inline_keyboard: [
        [
          // { text: 'Approve', url: 'https://discord.gg/' },
          // { text: 'Reject', url: 'https://discord.gg/' }
        ]
      ]
    }));

    // 4. Send photo to Telegram
    const url = `https://api.telegram.org/bot${fund.teleApi}/sendPhoto`;
    await axios.post(url, formData, {
      headers: formData.getHeaders()
    });

  } catch (error) {
    console.error("Failed to send UPI order message:", error);
  }
};


const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const validation = await validateTransPass(req);
    if (!validation.success) {
      throw new Error(validation.message);
    }

    const { usdt, fiat, fund, bankCard } = req.body;
    const user = req.user;

    if (user.availableBalance < usdt) {
      throw new Error("Insufficient balance");
    }

    const fundDoc = await fundModel.findOne({ _id: fund._id, status: "active" }).session(session);
    if (
      !fundDoc ||
      fund.rate !== fundDoc.rate ||
      Math.abs(fiat / fundDoc.rate - usdt) > 0.01
    ) {
      throw new Error("Fund not available or rate mismatch");
    }

    const bankDoc = await bankCardModel.findOne({ _id: bankCard._id, userId: user._id }).session(session);
    if (!bankDoc) {
      throw new Error("Invalid bank card");
    }

    const orderId = await generateUniqueWithdrawTransactionId();

    const newOrder = new orderModel({
      userId: user._id,
      fund: fundDoc._id,
      usdt,
      fiat,
      orderId,
      bankCard: bankDoc.mode === "upi"
        ? {
            mode: bankDoc.mode,
            upi: bankDoc.upi, // ✅ Correct: assigning the actual UPI ID
            accountName : bankDoc.accountName
          }
        : {
            mode: bankDoc.mode,
            accountNumber: bankDoc.accountNumber,
            accountName: bankDoc.accountName,
            ifsc: bankDoc.ifsc,
          },
    });

    const fixedUsdt = Number(parseFloat(usdt).toFixed(2));

    user.processing += fixedUsdt;
    user.availableBalance -= fixedUsdt;
    user.totalBalance = user.availableBalance + user.processing;

    await newOrder.save({ session });
    await userModel.updateOne({ _id: user._id }, {
      $set: {
        processing: user.processing,
        availableBalance: user.availableBalance,
        totalBalance: user.totalBalance,
      },
    }, { session });

    await session.commitTransaction();
    if(newOrder.bankCard.mode==="bank"){
      await sentBankOrderMessage(newOrder,fundDoc)
    } else if(newOrder.bankCard.mode==="upi"){
      await sentUpiOrderMessage(newOrder,fundDoc)
    }
    
    const updatedUser = await userModel.findById(user._id).select('-transactionPin');

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      user: updatedUser,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("createOrder error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to create order" });
  } finally {
    session.endSession();
  }
};

const fetchOrders=async(req,res)=>{
    try {
        const user = req.user
        const orders = await orderModel
        .find({userId : user._id})
        .populate("fund") 
        .select("-teleApi -teleChannel")
        .sort({createdAt : -1})

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