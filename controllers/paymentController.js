const depositModel = require("../model/deposit")
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

const generateUniqueCode = () => {
    const buffer = crypto.randomBytes(6); 
    const code = buffer.toString('hex').slice(0, 12); 
    return code;
  };

//text - 4,403 txid = 1ffc3f46f92b577f6c6d62ba7a4a4f79e098d69b0b02a59a361541aeeff62fb5

const verifyPayment=async(req,res)=>{
    try {
        const { txid,id } = req.body
        
        const deposit = await depositModel.findOne({_id : id})
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
            amount >= expectedAmount &&
            txReceipt.receipt.result === 'SUCCESS'
        );

        if(isValid){
           await depositModel.updateOne({_id : id},{$set : {txid}})
           return res.status(200).json({success : true,message : "Deposit added successfully"})
        } else {
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

module.exports ={
    verifyPayment,
    fetchMainAddress,
    fetchDepositHistory
}