const express = require('express')
const router = express.Router();
const {
    signup,
    logout,
    createDeposit
} = require('../controllers/userController')
const { verifyUser } = require('../middleware/userAuth');
const { 
    verifyPayment, 
    fetchMainAddress, 
    fetchDepositHistory 
} = require('../controllers/paymentController');

router.post('/signup',signup)

router.use(verifyUser)

router.get('/auth/verify', (req, res) => {
    console.log("/auth/verify");
    return res.status(200).json({ authenticated: true, user: req.user });
});

router.route('/deposit')
    .post(createDeposit)
    .patch(verifyPayment)

router.get('/address',fetchMainAddress)
router.get('/deposit-history',fetchDepositHistory)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
router.post("/logout", logout);

module.exports=router