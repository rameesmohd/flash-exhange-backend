const userModel = require('../model/user')
const depositModel = require('../model/deposit')
const jwt = require('jsonwebtoken');
const bankCardModel = require('../model/bankCard');
const JWT_SECRET = process.env.JWT_SECRET || "dfdsfh3434dfsd343";
const JWT_EXPIRES_IN = "1d";
const bcrypt = require("bcrypt");
const otpModel = require('../model/otp');

const createToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  };

const generateUniqueInviteCode = async () => {
  let codeExists = true;
  let inviteCode = '';

  while (codeExists) {
    inviteCode  = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7-digit number
    const existing = await userModel.findOne({ inviteCode  });
    if (!existing) {
      codeExists = false;
    }
  }

  return inviteCode;
};

const signin = async (req, res) => {
    try {
      const { email, otp } = req.body;
      console.log(req.body);
    
      let user = await userModel.findOne({ email });
      
      if (!user) {
        return res.status(400).json({
          message: "User not found. Please sign up to proceed",
          success: false
        });
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

const signup = async (req, res) => {
    try {
      const { email, phone ,referralCode } = req.body;
      console.log(req.body);
    
      let user = await userModel.findOne({ email });
      
      if (!user) {
        console.log('aaaaaaaaaa');
        
        const inviteCode = await generateUniqueInviteCode();
        console.log(inviteCode);

        let referrer = null;
        if (referralCode) {
          const refUser = await userModel.findOne({ referralCode });
          if (refUser) {
            referrer = refUser._id;
          }
        }
        
        user = new userModel({
          email,
          phone,
          inviteCode,
          referrer
        });

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
      console.log("req.cookies.token" ,req.cookies.token);
      
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
    console.log(req.body);
    
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

const deleteBankCard = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.query;
    console.log(req.query);
    
    if (!id) {
      return res.status(400).json({ success: false, message: "Card ID is required" });
    }

    const bankCard = await bankCardModel.findOneAndDelete({ _id: id, userId: user._id });

    if (!bankCard) {
      return res.status(404).json({ success: false, message: "Bank card not found or already deleted" });
    }
    const bankCards = await bankCardModel.find({userId :user._id })
    return res.status(200).json({ success: true, message: "Bank card deleted successfully" ,bankCards});

  } catch (error) {
    console.error("Error deleting bank card:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const sendOTP = async(req,res)=>{
  try {
    const user = req.user
    const OTP = Math.floor(100000 + Math.random() * 900000);

    const newOtp = new otpModel({
      user : user._id,
      otp : OTP,
    })
    await newOtp.save()
    
    return res.status(200).json({
      otpId : newOtp._id,
      success: true,
      message: "Otp sent successfully" 
    });
  } catch (error) {
    console.error("Error deleting bank card:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

const setupTransPass = async (req, res) => {
  try {
    const user = req.user;
    const { newPin, otpId, OTP } = req.body;
    console.log(req.body);
    
    // Validate input
    if (!newPin) {
      return res.status(400).json({ success: false, message: "Transaction PIN is required." });
    }

    if (!otpId || !OTP) {
      return res.status(400).json({ success: false, message: "OTP verification failed. Please retry." });
    }

    // Verify OTP
    const otpRecord = await otpModel.findOne({ _id: otpId, otp: OTP });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP credentials." });
    }

    // Hash and update transaction password
    const hashedPin = await bcrypt.hash(newPin, 10);
    await userModel.updateOne(
      { _id: user._id },
      { $set: { transactionPin: hashedPin } }
    );

    return res.status(200).json({
      success: true,
      message: "Transaction PIN updated successfully.",
    });

  } catch (error) {
    console.error("Error in setupTransPass:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


const validateTransPass = async (req) => {
  try {
    const { pin } = req.body;
    const user = req.user;

    if (!pin) {
      return { success: false, status: 400, message: "Transaction pin required" };
    }

    if (!user.transactionPin) {
      return { success: false, status: 400, message: "Please update your transaction pin" };
    }

    const isMatch = await bcrypt.compare(pin, user.transactionPin);

    if (isMatch) {
      return { success: true };
    } else {
      return { success: false, status: 400, message: "Incorrect PIN " };
    }
  } catch (error) {
    return { success: false, status: 500, message: "Server error" };
  }
};


module.exports={
    signup,
    signin,
    logout,

    addBankCard,
    fetchBankCards,
    deleteBankCard,

    sendOTP,
    setupTransPass,
    validateTransPass
}