const userModel = require('../model/user')
const depositModel = require('../model/deposit')
const jwt = require('jsonwebtoken');
const bankCardModel = require('../model/bankCard');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "1d";
const bcrypt = require("bcrypt");
const otpModel = require('../model/otp');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_SECRET_KEY);

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

const signup = async (req, res) => {
  try {
    const { email, phone, referralCode, otpId, otp } = req.body;

    const otpRecord = await otpModel.findOne({ _id: otpId, otp });

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
      referralCode: newReferralCode,
      referrer,
    });

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
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
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
    const token = req.cookies.token;

    if (!token) {
      return res.status(400).json({ success: false, message: "No token provided" });
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
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
    });
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ success: false, message: "Invalid request" });
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

    try {
    await resend.emails.send({
      from: process.env.NOREPLY_WEBSITE_MAIL,
      to: user.email,
      subject: 'Email Verification - E Value Trade',
      html: `
        <div style="font-family: sans-serif; padding: 10px;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p>Use the OTP below to verify your email:</p>
          <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${OTP}</div>
          <p>This code will expire in 10 minutes.</p>
            <br/>
            <p>Thanks,<br/>E Value Trade Team</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
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



const sendOtpSignup = async (req, res) => {
  try {
    const { email } = req.body;

    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }

    const OTP = Math.floor(100000 + Math.random() * 900000);

    const newOtp = new otpModel({
      user : email,
      otp : OTP,
    })

    await newOtp.save()

    try {
      await resend.emails.send({
        from: process.env.NOREPLY_WEBSITE_MAIL,
        to: email,
        subject: 'Email Verification - E Value Trade',
        html: `
          <div style="font-family: sans-serif; padding: 10px;">
            <h2 style="color: #333;">Your Verification Code</h2>
            <p>Use the OTP below to verify your email:</p>
            <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${OTP}</div>
            <p>This code will expire in 10 minutes.</p>
            <br/>
            <p>Thanks,<br/>E Value Trade Team</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
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
      msg: 'Server error while sending OTP. Please try again later.',
    });
  }
};

module.exports={
    signup,
    sendOtpSignup,
    signin,
    logout,

    addBankCard,
    fetchBankCards,
    deleteBankCard,

    sendOTPResetTrans,
    setupTransPass,
    validateTransPass
}