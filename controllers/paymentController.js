const depositModel = require("../model/deposit")
const TronWeb = require('tronweb');
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


const verifyPayment=async(req,res)=>{
    try {
        const { txid,id } = req.body
        const deposit = await depositModel.findOne({_id : id})
        if(!deposit){
           return res.status(400).json({success : false,message : "Deposit order not found!"})
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
        
        const decoded = await tronWeb.transactionBuilder.decodeParams([
            { type: 'address' },
            { type: 'uint256' }
          ], contractData.data);

        const toAddress = tronWeb.address.fromHex(decoded[0]);
        const amount = parseInt(decoded[1]._hex || decoded[1]) / 1e6; // Adjust for USDT (6 decimals)

        const isValid = (
            txInfo.raw_data.contract[0].parameter.value.contract_address === tronWeb.address.toHex(contractAddress) &&
            toAddress === expectedToAddress &&
            amount === expectedAmount &&
            txReceipt.receipt.result === 'SUCCESS'
        );

        if(isValid){
            res.status(200).json({success : true,message : "Deposit credited successfully"})
        }
      
    } catch (error) {
        
    } 
}


module.exports ={
    verifyPayment
}