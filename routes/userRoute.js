const express = require('express')
const router = express.Router();
const { verifyUser } = require('../middleware/userAuth');
const {
    signup,
    logout,
    addBankCard,
    fetchBankCards,
    deleteBankCard,
    sendOTPResetTrans,
    setupTransPass,
    signin,
    sendOtpSignup,
    getReferrals,
    sendOtpSignIn,
} = require('../controllers/user/userController')
const { 
    verifyPayment, 
    fetchDepositHistory, 
    createDeposit,
    fetchAddress,
    saveAddress,
    submitWithdraw,
    fetchWithdrawHistory,
    cancelDeposit
} = require('../controllers/user/paymentController');
const { 
    fetchFunds, 
    createOrder, 
    fetchOrders
} = require('../controllers/user/orderController');

router.post('/signup',signup)
router.post('/signin',signin)

router.get("/logout", logout);

router.route('/send-otp')
      .get(verifyUser,sendOTPResetTrans)
      .post(sendOtpSignup)
      .patch(sendOtpSignIn) 

router.use(verifyUser)

router.get('/auth/verify', (req, res) => {
    console.log("/auth/verify");
    return res.status(200).json({ authenticated: true, user: req.user });
});

router.route('/deposit')
      .get(fetchDepositHistory)
      .post(createDeposit)
      .patch(verifyPayment)
      .delete(cancelDeposit)

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

router.route('/reset-pin')
      .post(setupTransPass)

router.route('/referrals')
      .get(getReferrals)


module.exports=router