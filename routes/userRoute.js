const express = require('express')
const router = express.Router();
const {
    signup,
    logout,
} = require('../controllers/userController')
const { verifyUser } = require('../middleware/userAuth');
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

router.post('/signup',signup)

router.use(verifyUser)

router.get('/auth/verify', (req, res) => {
    console.log("/auth/verify");
    return res.status(200).json({ authenticated: true, user: req.user });
});

router.get('/main-address',fetchMainAddress)

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

      
      
router.post("/logout", logout);

module.exports=router