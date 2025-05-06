const express = require('express')
const router = express.Router();
const {
    signup,
    logout,
    createDeposit
} = require('../controllers/userControllers')
const { verifyUser } = require('../middleware/userAuth')

router.post('/signup',signup)

router.use(verifyUser)

router.get('/auth/verify', (req, res) => {
    console.log("/auth/verify");
    return res.status(200).json({ authenticated: true, user: req.user });
});

router.route('/deposit')
    .post(createDeposit)
  
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
router.post("/logout", logout);

module.exports=router