const express = require('express')
const router = express.Router();
const {
    signup,
    logout
} = require('../controllers/userControllers')
const { verifyUser } = require('../middleware/userAuth')

router.post('/signup',verifyUser,signup)
router.post("/logout", verifyUser, logout);

module.exports=router