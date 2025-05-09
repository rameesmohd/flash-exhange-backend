const userModel = require('../model/user')
const depositModel = require('../model/deposit')
const jwt = require('jsonwebtoken');
const bankCardModel = require('../model/bankCard');
const JWT_SECRET = process.env.JWT_SECRET || "dfdsfh3434dfsd343";
const JWT_EXPIRES_IN = "1d";

const createToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  };

const signup = async (req, res) => {
    try {
      const { email, phone } = req.body;
      console.log(req.body);
    
      let user = await userModel.findOne({ email });

      if (!user) {
        user = new userModel({ email, phone });
        await user.save();
      }
  
      // Invalidate existing session
      const token = createToken(user._id);
      user.currentToken = token;
      await user.save();
  
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .status(200)
        .json({ success: true, message: "Logged in successfully", user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
};

const logout = async (req, res) => {
    try {
      const token = req.cookies.token;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await userModel.findById(decoded.userId);
      if (user) {
        user.currentToken = null;
        await user.save();
      }
      
      res.clearCookie("token").status(200).json({ success: true, message: "Logged out" });
    } catch (err) {
      return res.status(400).json({success: false, message: "Invalid request" });
    }
};

const addBankCard=async(req,res)=>{
  try {
    const { accountNumber,ifsc,accountName} = req.body
    const user =  req.user
    const newBankCard = new bankCardModel({
      userId : user._id,
      accountNumber,
      ifsc,
      accountName
    })
    await newBankCard.save()
    return res.status(200).json({success: true,message : "Bank card added successfully"})
  } catch (error) {
    console.log(error);
    return res.status(400).json({success: false, message: "Server error" });
  }
}

const fetchBankCards=async(req,res)=>{
  try {
    const user = req.user
    const bankCards = await bankCardModel.find({userId :user._id })
    res.status(200).json({success: true,bankCards})
  } catch (error) {
    console.log(error);
    return res.status(400).json({success: false, message: "Server error" });
  }
}

module.exports={
    signup,
    logout,

    addBankCard,
    fetchBankCards
}