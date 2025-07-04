require('dotenv').config();
const userModel = require('../../model/user')
const jwt = require('jsonwebtoken');
const bankCardModel = require('../../model/bankCard');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
const bcrypt = require("bcrypt");
const otpModel = require('../../model/otp');
const { Resend } = require("resend");
const referralModel = require('../../model/referrals');
const notification = require('../../model/notification');
const { otpVerification } = require('../../utility/mails');
const resend = new Resend(process.env.RESEND_SECRET_KEY);

const createToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const generateUniqueInviteCode = async () => {
  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const inviteCode = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7-digit number
    const existing = await userModel.findOne({ referralCode: inviteCode });
    if (!existing) return inviteCode;
  }
  throw new Error("Failed to generate unique invite code after multiple attempts");
};

const signup = async (req, res) => {
  try {
    const { email, phone, referralCode, otpId, otp,transactionPin } = req.body;

    const otpRecord = await otpModel.findOne({ _id: otpId, otp });

    if(!transactionPin || transactionPin.length!=6){
      return res.status(400).json({ success: false, message: "Invalid Transaction Pin." });
    }

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    let user = await userModel.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: "User already exists. Please login." });
    }

    user = await userModel.findOne({ phone });
    if (user) {
      return res.status(400).json({ success: false, message: "Mobile number already in use." });
    }

    const newReferralCode = await generateUniqueInviteCode();

    let refUserId = null;
    let refUser = null
    if (referralCode) {
      refUser = await userModel.findOne({ referralCode });
      if (refUser) {
        refUserId = refUser._id;
      }
    }

    if (!newReferralCode) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate referral code. Try again.",
      });
    }
    
    const hashedPin = await bcrypt.hash(transactionPin, 10);

    user = new userModel({
      email,
      phone,
      referralCode: newReferralCode,
      referrer:refUserId,
      transactionPin : hashedPin
    });
    
    const token = createToken(user._id);
    user.currentToken = token;
    
    await user.save();
    
    // Save referral Level 1 
    if (refUser) {
      await userModel.findByIdAndUpdate(
        refUser._id,
          { $inc: { 'totalReferrals.levelOne': 1 } }
      );
      await referralModel.create({
        referredBy: refUser._id,
        referee: user._id,
        level: "Level 1",
      });

    // Level 2 if refUser also has a referrer
    if (refUser.referrer) {
      await userModel.findByIdAndUpdate(
        refUser.referrer,
        { $inc: { 'totalReferrals.levelTwo': 1 } },
      );
      await referralModel.create({
        referredBy: refUser.referrer,
        referee: user._id,
        referredVia: refUser._id,
        level: "Level 2",
      });
    }}

    res
      .cookie("userToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        ...(process.env.NODE_ENV === "production" && { domain: ".evaluetrade.in" }),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .status(200)
      .json({
        success: true,
        message: "Logged in successfully",
        user
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const signin = async (req, res) => {
  try {
    const { email, otpId, otp } = req.body;
    
    // Verify OTP
    const otpRecord = await otpModel.findOne({ _id: otpId, otp });

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: "User does not exist. Please sign up." });
    }

    const token = createToken(user._id);
    user.currentToken = token;

    await user.save();

    res
      .cookie("userToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        ...(process.env.NODE_ENV === "production" && { domain: ".evaluetrade.in" }),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .status(200)
      .json({
        success: true,
        message: "Logged in successfully",
        user
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.userToken;
    
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findById(decoded.userId);

    if (user) {
      user.currentToken = null;
      await user.save();
    }

    res.clearCookie( "token", 
    {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        ...(process.env.NODE_ENV === "production" && { domain: ".evaluetrade.in" }),
    });
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Invalid request" });
  }
};

const addBankCard=async(req,res)=>{
  try {
    const { accountNumber, ifsc, accountName, mode, upi } = req.body;
    const user = req.user;

    // Helper regex patterns
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/; // Example: HDFC0001234
    const accountNumberRegex = /^\d{9,18}$/;
    const upiRegex = /^[\w.-]+@[\w.-]+$/;

    if (!mode || !["bank", "upi"].includes(mode)) {
      return res.status(400).json({ success: false, message: "Invalid or missing mode" });
    }

    if (mode === "bank") {
      
      if (!accountNumber || !accountName || !ifsc) {
        return res.status(400).json({ success: false, message: "All bank details are required" });
      }

      if (!accountNumberRegex.test(accountNumber)) {
        return res.status(400).json({ success: false, message: "Invalid account number" });
      }

      if (!ifscRegex.test(ifsc)) {
        return res.status(400).json({ success: false, message: "Invalid IFSC code" });
      }

      const newBankCard = new bankCardModel({
        userId: user._id,
        accountNumber,
        ifsc,
        accountName,
        mode
      });
      await newBankCard.save();

    } else if (mode === "upi") {
      if (!upi) {
        return res.status(400).json({ success: false, message: "UPI ID is required" });
      }

      if (!upiRegex.test(upi)) {
        return res.status(400).json({ success: false, message: "Invalid UPI ID" });
      }
      
      const newBankCard = new bankCardModel({
        userId: user._id,
        upi,
        accountName,
        mode
      });
      await newBankCard.save();
    }

    return res.status(200).json({ success: true, message: "Bank card added successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({success: false, message: "Server error" });
  }
}

const fetchBankCards=async(req,res)=>{
  try {
    const user = req.user
    const { mode } = req.query
    const bankCards = await bankCardModel.find({ 
        userId :user._id,
        ...(mode=="null" ? {} :{mode})
      },
    )
    return res.status(200).json({success: true,bankCards})
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

const sendOTPResetTrans = async(req,res)=>{
  try {
    const user = req.user
    const OTP = Math.floor(100000 + Math.random() * 900000);

    const newOtp = new otpModel({
      user : user.email,
      otp : OTP,
    })
    await newOtp.save()


    if (process.env.NODE_ENV === "production") {
      try {

        await resend.emails.send({
          from: process.env.NOREPLY_WEBSITE_MAIL,
          to: user.email,
          subject: 'Email Verification - eValueTrade',
          html: otpVerification(OTP),
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again.',
        });
      }
    }else {
       console.log(`Development Mode: OTP for ${user.email} is ${OTP}`);
    }
    
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
    const user = await userModel.findOne({_id : req.user._id}) 
    
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

const sendOtpSignIn = async (req, res) => {
  try {
    const { email } = req.body;
    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }

    const isExist = await userModel.findOne({email})
    if (!isExist) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sign up to continue.',
      });
    }

    const OTP = Math.floor(100000 + Math.random() * 900000);

    const newOtp = new otpModel({
      user : email,
      otp : OTP,
    })

    await newOtp.save()

    if (process.env.NODE_ENV === "production") {
      try {
        await resend.emails.send({
          from: process.env.NOREPLY_WEBSITE_MAIL,
          to: email,
          subject: 'Email Verification - eValueTrade',
          html: otpVerification(OTP),
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again.',
        });
      }
    } else {
      console.log(`Development Mode: OTP for ${email} is ${OTP}`);
    }

    return res.status(200).json({
      otpId : newOtp._id,
      success: true,
      message: 'OTP sent successfully to your email.',
    });

  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while sending OTP. Please try again later.',
    });
  }
};

const sendOtpSignup = async (req, res) => {
  try {
    const { email } = req.body;
    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    
    const isExist = await userModel.findOne({email})
    if (isExist) {
      return res.status(404).json({
        success: false,
        message: 'User already exist. Please sign in to continue.',
      });
    }

    const OTP = Math.floor(100000 + Math.random() * 900000);

    const newOtp = new otpModel({
      user : email,
      otp : OTP,
    })

    await newOtp.save()

    if (process.env.NODE_ENV === "production") {
      try {
        await resend.emails.send({
          from: process.env.NOREPLY_WEBSITE_MAIL,
          to: email,
          subject: 'Email Verification - eValueTrade',
          html: otpVerification(OTP),
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please try again.',
        });
      }
    } else {
      console.log(`Development Mode: OTP for ${email} is ${OTP}`);
    }

    return res.status(200).json({
      otpId : newOtp._id,
      success: true,
      message: 'OTP sent successfully to your email.',
    });

  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while sending OTP. Please try again later.',
    });
  }
};

const getReferrals=async(req,res)=>{
  try {
    const user = req.user
    const referrals = await referralModel.find({ referredBy: user._id })
    .populate({ path: 'referee', select: 'email' });

    return res.status(200).json({ 
      success: true,
      referrals
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while sending OTP. Please try again later.',
    });
  }
}

const getNotifications=async(req,res)=>{
  try {
    const notifications = await notification.find().sort({ createdAt: -1 });
    res.status(200).json({success: true, notifications});
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

module.exports={
    signup,
    sendOtpSignup,
    signin,
    logout,

    addBankCard,
    fetchBankCards,
    deleteBankCard,

    sendOtpSignIn,
    sendOTPResetTrans,
    setupTransPass,
    validateTransPass,

    getReferrals,

    getNotifications
}