const express = require('express')
const router = express.Router();
const { verifyUser } = require('../middleware/userAuth');
const {
    signup,
    logout,
    addBankCard,
    fetchBankCards,
    deleteBankCard,
    sendOTP,
    setupTransPass,
    signin,
} = require('../controllers/userController')
const { 
    verifyPayment, 
    fetchMainAddress, 
    fetchDepositHistory, 
    createDeposit,
    fetchAddress,
    saveAddress,
    submitWithdraw,
    fetchWithdrawHistory
} = require('../controllers/paymentController');
const { 
    fetchFunds, 
    createOrder, 
    fetchOrders
} = require('../controllers/orderController');

router.post('/signup',signup)
router.post('/signin',signin)


router.use(verifyUser)

router.get('/auth/verify', (req, res) => {
    console.log("/auth/verify");
    return res.status(200).json({ authenticated: true, user: req.user });
});

router.route('/deposit')
      .get(fetchDepositHistory)
      .post(createDeposit)
      .patch(verifyPayment)

router.route("/withdraw")
      .get(fetchWithdrawHistory)
      .post(submitWithdraw)

router.route('/address')
      .get(fetchAddress)
      .post(saveAddress)

router.route('/bank-card')
      .get(fetchBankCards)   
      .post(addBankCard)  
      .delete(deleteBankCard) 

router.route('/fund')
      .get(fetchFunds)
      
router.route('/order')
      .get(fetchOrders)
      .post(createOrder)

router.get('/send-otp',sendOTP)

router.route('/reset-pin')
      .post(setupTransPass)
      
router.get("/logout", logout);

module.exports=router