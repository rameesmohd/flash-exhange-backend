const adminModel = require("../../model/admin");
const companyAddressesModel = require("../../model/companyAddress");
const userModel = require("../../model/user");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const createEncrypt =async ()=>{
    const password = '7yW3gM8ss'
    const hashpassword = await bcrypt.hash(password, 10);
    console.log(hashpassword);
}
// console.log(createEncrypt());

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const admin = await adminModel.findOne({ email });
    if (!admin) {
      return res.status(400).json({ success: false, message: "Incorrect email or password." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect email or password." });
    }

    const token = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET_ADMIN, { expiresIn: '1d' });

    admin.currentToken = token;
    await admin.save();

    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      ...(process.env.NODE_ENV === "production" && { domain: ".evaluetrade.com" }),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const fetchUsers = async(req,res)=>{
    try {
        const users = await userModel.find({})
        res.status(200).json({users,success: true})
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const fetchCompanyAddress = async (req,res)=>{
    try {
        const { status } = req.query
        const companyAddress = await companyAddressesModel.find({status}).sort({priority : 1})
        res.status(200).json({success: true,result : companyAddress})
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}

const addCompanyAddress = async (req, res) => {
  try {
    const { address, status, priority,flag } = req.body;
    console.log(req.body);
    
    if (!address || !status || !priority || flag === undefined) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Check if address already exists
    const existingAddress = await companyAddressesModel.findOne({ address });
    if (existingAddress) {
      return res.status(409).json({ success: false, message: 'Address already exists.' });
    }

    const newAddress = new companyAddressesModel({
      address,
      priority,
      flag,
      status
    });
    
    await newAddress.save();

    return res.status(201).json({
      success: true,
      message: 'Company address added successfully.',
      result: newAddress,
    });
  } catch (error) {
    console.error('Error adding company address:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const updateAddress = async(req,res)=>{
 try {
    const { _id, status, priority,flag } = req.body;

    if (!_id || !status || !priority || !flag || !priority) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existing = await companyAddressesModel.findById(_id);
    if (!existing) {
      return res.status(400).json({ success: false, message: 'Address not found.' });
    }

    existing.status = status;
    existing.priority = priority;
    existing.flag = flag;

    await existing.save();

    return res.status(200).json({
      success: true,
      message: 'Company address updated successfully.',
    });

  } catch (error) {
    console.error('Error updating company address:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

const changeUserEmail = async (req, res) => {
    try {
      const { newEmail, user_id } = req.body;
  
      if (!newEmail || !user_id) {
        return res.status(400).json({ errMsg: "newEmail and user_id are required" });
      }
  
      const updatedUser = await userModel.findByIdAndUpdate(
        user_id,
        { $set: { email: newEmail } },
        { new: true, runValidators: true } 
      );
  
      if (!updatedUser) {
        return res.status(404).json({ errMsg: "User not found" });
      }
  
      return res.status(200).json({ msg: "Email updated successfully"});
    } catch (error) {
      console.error("Error changing email:", error);
      return res.status(500).json({ errMsg: "Error changing email", error });
    }
};


module.exports = {
    login,
    fetchUsers,

    fetchCompanyAddress,
    addCompanyAddress,
    updateAddress,

    changeUserEmail
}