const addressModel = require("../model/address");
const depositModel = require("../model/deposit")
const userModel = require('../model/user');
const withdrawModel = require("../model/withdraw");
const generateSixDigitId = require('../utility/generateSixDigitId')
const  TronWeb  = require('tronweb');
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


const createDeposit =async(req,res)=>{
    try {
        const { amount } = req.body
        const user = req.user

        if(!user || !amount){
        return res.status(400).json({success: false, message: "Invalid request" });
        }

        const transaction_id = await generateUniqueDepositTransactionId()

        const newDeposit = new depositModel({
        userId : user._id,
        amount,
        transactionId : `${transaction_id}`
        })

        await newDeposit.save()

        res.status(201).json({success:true,message : "deposit created succesfully", deposit:newDeposit})
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success : false,message: "Server error" });
    }
}

//text - 4,403 txid = 1ffc3f46f92b577f6c6d62ba7a4a4f79e098d69b0b02a59a361541aeeff62fb5

const verifyPayment=async(req,res)=>{
    try {
        const { txid,id } = req.body
        const user = req.user
        const deposit = await depositModel.findOne({_id : id,status : "pending"})
        if(!deposit){
           return res.status(400).json({success : false,message : "Deposit order not found!"})
        }

        const alreadyUsed = await depositModel.findOne({txid})
        if(alreadyUsed){
           return res.status(400).json({success :false,message : "Trasaction Id already used"})
        }

        const tronWeb = createTronWebInstance(process.env.PRIVATE_KEY);
        const expectedToAddress = process.env.MAIN_ADDRESS
        const expectedAmount = deposit.amount
        const contractAddress = USDT_CONTRACT_ADDRESS

        const txInfo = await tronWeb.trx.getTransaction(txid);
        const txReceipt = await tronWeb.trx.getTransactionInfo(txid);
        
        if (!txInfo || !txReceipt) {
           console.log('Transaction not found or not confirmed yet.');
           return res.status(400).json({success : false,message : "Transaction not confirmed yet"})
        }

        const contractData = txInfo.raw_data.contract[0].parameter.value;
        const contractType = txInfo.raw_data.contract[0].type;

        if (contractType !== "TriggerSmartContract") {
           console.log('Not a smart contract transaction.');
           return res.status(400).json({success : false,message : "Not a smart contract transaction"})
        }
        
        const data = contractData.data; 

        const params = data.slice(8); // remove method ID ("a9059cbb")
        const toHex = '41' + params.slice(24, 64); // TRON address (last 40 chars of address + "41" prefix)
        const amountHex = params.slice(64, 128); // amount

        const toAddress = tronWeb.address.fromHex(toHex);
        const amount = parseInt(amountHex, 16) / 1e6; // USDT uses 6 decimals

        const isValid = (
            txInfo.raw_data.contract[0].parameter.value.contract_address === tronWeb.address.toHex(contractAddress) &&
            toAddress === expectedToAddress &&
            amount == expectedAmount &&
            txReceipt.receipt.result === 'SUCCESS'
        );

        if(isValid){
        await depositModel.updateOne({_id : id},{$set : {txid,status:"success"}})
        
        const newTotal = Math.round((user.totalBalance + amount) * 100) / 100;
        const newAvailable = Math.round((newTotal - user.processing - user.disputeAmount) * 100) / 100;

        await userModel.updateOne(
        { _id: user._id },
        {
            $set: {
            totalBalance: newTotal,
            availableBalance: newAvailable }
        });
          
        return res.status(200).json({success : true,message : "Deposit added successfully"})
        } else {
            if(toAddress != expectedToAddress){
                return res.status(400).json({success : false,message : "Wrong destination"})
            }
           if(amount>1 && amount != expectedAmount){
                return res.status(400).json({success : false,message : "Transaction amount is insufficient"})
           }
           return res.status(400).json({success : false,message : "Transaction not completed"})
        }     
    } catch (error) {
        console.log(error);
        return res.status(500).json({success : false,message : "Server error"})
    } 
}

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
        const deposits = await depositModel.find({userId: user._id})
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

const submitWithdraw=async(req,res)=>{
    try {
        const { amount,addressId } = req.body
        const user = req.user
        
        const address = await addressModel.findOne({_id : addressId,userId:user._id})
        
        if(!address){
            return res.status(200).json({success : false,message : "Invalid reciever address"})
        }

        if(amount > user.avalableBalance){
            return res.status(200).json({success : false,message : "Insufficient available balance"})
        }

        const newTransactionId = await generateUniqueWithdrawTransactionId()
        const newWithdraw = new withdrawModel({
            userId : user._id,
            amount ,
            recieveAddress : address.address,
            transactionId : newTransactionId
        })
        await newWithdraw.save()

        return res.status(200).json({success: true,message : "Withdraw submited successfully",withdraw:newWithdraw})
    } catch (error) {
        console.log(error)
        return res.status(500).json({success: false , message : "Server error"})
    }
}

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