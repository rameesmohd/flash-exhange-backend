const addressModel = require("../../model/address");
const depositModel = require("../../model/deposit")
const userModel = require('../../model/user');
const withdrawModel = require("../../model/withdraw");
const generateSixDigitId = require('../../utility/generateSixDigitId')
const  TronWeb  = require('tronweb');
const mongoose = require("mongoose");
const { validateTransPass } = require("./userController");
const companyAddressesModel = require("../../model/companyAddress");
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Function to create a new TronWeb instance
const createTronWebInstance = (privateKey) => {
    return new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: privateKey
    });
};

// Function to initialize USDT contract
const initializeUsdtContract = async (tronWebInstance) => {
    return await tronWebInstance.contract().at(USDT_CONTRACT_ADDRESS);
};

const generateUniqueDepositTransactionId = async () => {
    let unique = false;
    let transactionId = '';

    while (!unique) {
        transactionId = generateSixDigitId();
        const existing = await depositModel.findOne({ transactionId });

        if (!existing) {
            unique = true;
        }
    }

    return transactionId;
};

const createDeposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    if (!user || !amount) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const transaction_id = await generateUniqueDepositTransactionId();

    // Atomically pick and lock an available address
    const availableAddress = await companyAddressesModel.findOneAndUpdate(
      {
        flag: false
      },
      {
        $set: { flag: true } 
      },
      {
        sort: { priority: 1 }, 
        new: true 
      }
    );

    if (!availableAddress) {
      return res.status(400).json({ success: false, message: "No available address for deposit,please wait few minutes" });
    }

    const newDeposit = new depositModel({
      userId: user._id,
      amount,
      transactionId: transaction_id,
      recieveAddress: availableAddress._id
    });

    await newDeposit.save();

    // Populate the recieveAddress field
    const populatedDeposit = await depositModel.findById(newDeposit._id).populate("recieveAddress");

    return res.status(201).json({
      success: true,
      message: "Deposit created successfully",
      deposit: populatedDeposit
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//text - 4,403 txid = 1ffc3f46f92b577f6c6d62ba7a4a4f79e098d69b0b02a59a361541aeeff62fb5

// const verifyPayment=async(req,res)=>{
//     try {
//         const { txid,id } = req.body
//         const user = req.user
//         const deposit = await depositModel.findOne({_id : id,status : "pending"})
//         if(!deposit){
//            return res.status(400).json({success : false,message : "Deposit order not found!"})
//         }

//         const alreadyUsed = await depositModel.findOne({txid})
//         if(alreadyUsed){
//            return res.status(400).json({success :false,message : "Trasaction Id already used"})
//         }

//         const tronWeb = createTronWebInstance(process.env.PRIVATE_KEY);
//         const expectedToAddress = process.env.MAIN_ADDRESS
//         const expectedAmount = deposit.amount
//         const contractAddress = USDT_CONTRACT_ADDRESS

//         const txInfo = await tronWeb.trx.getTransaction(txid);
//         const txReceipt = await tronWeb.trx.getTransactionInfo(txid);
        
//         if (!txInfo || !txReceipt) {
//            console.log('Transaction not found or not confirmed yet.');
//            return res.status(400).json({success : false,message : "Transaction not confirmed yet"})
//         }

//         const contractData = txInfo.raw_data.contract[0].parameter.value;
//         const contractType = txInfo.raw_data.contract[0].type;

//         if (contractType !== "TriggerSmartContract") {
//            console.log('Not a smart contract transaction.');
//            return res.status(400).json({success : false,message : "Not a smart contract transaction"})
//         }
        
//         const data = contractData.data; 

//         const params = data.slice(8); // remove method ID ("a9059cbb")
//         const toHex = '41' + params.slice(24, 64); // TRON address (last 40 chars of address + "41" prefix)
//         const amountHex = params.slice(64, 128); // amount

//         const toAddress = tronWeb.address.fromHex(toHex);
//         const amount = parseInt(amountHex, 16) / 1e6; // USDT uses 6 decimals

//         const isValid = (
//             txInfo.raw_data.contract[0].parameter.value.contract_address === tronWeb.address.toHex(contractAddress) &&
//             toAddress === expectedToAddress &&
//             amount == expectedAmount &&
//             txReceipt.receipt.result === 'SUCCESS'
//         );

//         if(isValid){
//         await depositModel.updateOne({_id : id},{$set : {txid,status:"success"}})
        
//         const newTotal = Math.round((user.totalBalance + amount) * 100) / 100;
//         const newAvailable = Math.round((newTotal - user.processing - user.disputeAmount) * 100) / 100;

//         await userModel.updateOne(
//         { _id: user._id },
//         {
//             $set: {
//             totalBalance: newTotal,
//             availableBalance: newAvailable }
//         });
          
//         return res.status(200).json({success : true,message : "Deposit added successfully"})
//         } else {
//             if(toAddress != expectedToAddress){
//                 return res.status(400).json({success : false,message : "Wrong destination"})
//             }
//            if(amount>1 && amount != expectedAmount){
//                 return res.status(400).json({success : false,message : "Transaction amount is insufficient"})
//            }
//            return res.status(400).json({success : false,message : "Transaction not completed"})
//         }     
//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({success : false,message : "Server error"})
//     } 
// }

const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { txid, id } = req.body;
    const user = req.user;

    const deposit = await depositModel.findOne({ _id: id, status: "pending" }).session(session);
    if (!deposit) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Deposit request not found or already processed." });
    }

    const alreadyUsed = await depositModel.findOne({ txid }).session(session);
    if (alreadyUsed) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "This transaction ID has already been used." });
    }

    const tronWeb = createTronWebInstance(process.env.PRIVATE_KEY);
    const expectedToAddress = process.env.MAIN_ADDRESS;
    const expectedAmount = deposit.amount;
    const contractAddress = USDT_CONTRACT_ADDRESS;

    const txInfo = await tronWeb.trx.getTransaction(txid);
    const txReceipt = await tronWeb.trx.getTransactionInfo(txid);

    if (!txInfo || !txReceipt) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Transaction not found or not confirmed yet." });
    }

    const contract = txInfo.raw_data?.contract?.[0];
    if (!contract || contract.type !== "TriggerSmartContract") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Invalid transaction type. Expected smart contract transfer." });
    }

    const { value } = contract.parameter;
    if (value.contract_address !== tronWeb.address.toHex(contractAddress)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Incorrect contract address. Expected USDT transfer." });
    }

    const data = value.data;
    const params = data.slice(8);
    const toHex = "41" + params.slice(24, 64);
    const amountHex = params.slice(64, 128);

    const toAddress = tronWeb.address.fromHex(toHex);
    const amount = parseInt(amountHex, 16) / 1e6;

    const isSuccessful = txReceipt.receipt?.result === "SUCCESS";
    const isToAddressValid = toAddress === expectedToAddress;
    const isAmountValid = amount === expectedAmount;

    if (isSuccessful && isToAddressValid && isAmountValid) {
      // Update deposit
      await depositModel.updateOne(
        { _id: id },
        { $set: { txid, status: "success" } },
        { session }
      );

      // Re-fetch user inside transaction (optional but cleaner)
      const dbUser = await userModel.findById(user._id).session(session);
      const newTotal = Math.round((dbUser.totalBalance + amount) * 100) / 100;
      const newAvailable = Math.round((newTotal - dbUser.processing - dbUser.disputeAmount) * 100) / 100;

      await userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            totalBalance: newTotal,
            availableBalance: newAvailable,
          },
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true, message: "Deposit verified and credited successfully." });
    } else {
      await session.abortTransaction();
      if (!isToAddressValid) {
        return res.status(400).json({ success: false, message: "Transaction sent to the wrong address." });
      }
      if (amount > 1 && !isAmountValid) {
        return res.status(400).json({ success: false, message: "Transaction amount mismatch." });
      }
      return res.status(400).json({ success: false, message: "Transaction failed or not successful." });
    }
  } catch (error) {
    console.error("verifyPayment error:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: "An internal server error occurred." });
  }
};


const fetchMainAddress=async(req,res)=>{
    try {
        const address = process.env.MAIN_ADDRESS
        res.status(200).json({success : true,address})
    } catch (error) {
        console.log(error);
        return res.status(500).json({success : false,message : "Server error"})
    }
}

const fetchDepositHistory=async(req,res)=>{
    try {
        const user = req.user
        const deposits = await depositModel.find({userId: user._id}).populate("recieveAddress");
        res.status(200).json({success : true,deposits})
    } catch (error) {
        console.log(error);
        return res.status(500).json({success : false,message : "Server error"})
    }
}

const saveAddress=async(req,res)=>{
    try {
        const {address}=req.body
        const user = req.user
        if(!address ){
           return res.status(400).json({success : false,message : "Invalid request"})
        }

        const alreadyExist = await addressModel.findOne({userId : user._id,address})
        if(alreadyExist){
           return  res.status(400).json({success : false,message : "Already exist"})
        }

        const newaddress = new addressModel({
            userId : user._id,
            address,
        })

        await newaddress.save()
        return res.status(200).json({success : true,message : "Address saved successfully"})
    } catch (error) {
        console.log(error)
        return res.status(500).json({success: false , message : "Server error"})
    }
}

const fetchAddress=async(req,res)=>{
    try {
        const user = req.user
        const address = await addressModel.find({userId : user._id})
        return res.status(200).json({
            success : true,
            address
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({success: false , message : "Server error"})
    }
}

const generateUniqueWithdrawTransactionId = async () => {
    let unique = false;
    let transactionId = '';
    
    while (!unique) {
        transactionId = generateSixDigitId();
        const existing = await withdrawModel.findOne({ transactionId });
    
        if (!existing) {
            unique = true;
        }
    }
    
    return transactionId;
    };

// const submitWithdraw=async(req,res)=>{
//     try {
//         const validation = await validateTransPass(req);
//         if (!validation.success) {
//             return res.status(validation.status).json({ success: false, message: validation.message });
//         }
        
//         const { addressId } = req.body
//         const amount = Number(req.body.amount)
//         const user = req.user
//         const address = await addressModel.findOne({_id : addressId,userId:user._id})
        

//         if(!address){
//             return res.status(200).json({success : false,message : "Invalid reciever address"})
//         }

//         if(amount > user.availableBalance){
//             return res.status(200).json({success : false,message : "Insufficient available balance"})
//         }

//         const newTransactionId = await generateUniqueWithdrawTransactionId()
//         const newWithdraw = new withdrawModel({
//             userId : user._id,
//             amount ,
//             recieveAddress : address.address,
//             transactionId : newTransactionId
//         })
//         const availableBalance = user.availableBalance-amount
//         const processing = user.processing + amount
//         const totalBalance = availableBalance+processing
//         const updatedUser = await userModel.findOneAndUpdate(
//             { _id: user._id },
//             {
//                 $set: {
//                 totalBalance,
//                 processing,
//                 availableBalance
//                 }
//             },
//             {
//                 new: true ,
//                 fields: { transactionPassword: 0 },
//             }
//         );
//         await newWithdraw.save()
//         return res.status(200).json({success: true,message : "Withdraw submited successfully",withdraw:newWithdraw,user:updatedUser})
//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({success: false , message : "Server error"})
//     }
// }

const submitWithdraw = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const validation = await validateTransPass(req);
    if (!validation.success) {
      await session.abortTransaction();
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const { addressId } = req.body;
    const amount = Number(req.body.amount);
    const user = req.user;

    const address = await addressModel.findOne({ _id: addressId, userId: user._id }).session(session);
    if (!address) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Invalid receiver address." });
    }

    if (amount > user.availableBalance) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Insufficient available balance." });
    }

    const newTransactionId = await generateUniqueWithdrawTransactionId();

    const newWithdraw = new withdrawModel({
      userId: user._id,
      amount,
      recieveAddress: address.address,
      transactionId: newTransactionId,
    });

    const availableBalance = user.availableBalance - amount;
    const processing = user.processing + amount;
    const totalBalance = availableBalance + processing;

    const updatedUser = await userModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          availableBalance,
          processing,
          totalBalance,
        },
      },
      {
        session,
        new: true,
        fields: { transactionPassword: 0 },
      }
    );

    await newWithdraw.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Withdraw submitted successfully.",
      withdraw: newWithdraw,
      user: updatedUser,
    });
  } catch (error) {
    console.error("submitWithdraw error:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const fetchWithdrawHistory=async(req,res)=>{
    try {
        const user = req.user
        const withdraws = await withdrawModel.find({userId : user._id})
        return res.status(200).json({success : true,withdraws})
    } catch (error) {
        console.log(error)
        return res.status(500).json({success: false , message : "Server error"})
    }
}

module.exports ={
    fetchMainAddress,

    // Deposit
    createDeposit,
    verifyPayment,
    fetchDepositHistory,

    //Address
    saveAddress,
    fetchAddress,

    //Withdraw
    submitWithdraw,
    fetchWithdrawHistory
}