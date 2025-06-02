const companyAddressesModel = require("../../model/companyAddress");
const depositModel = require("../../model/deposit");
const fundModel = require("../../model/fund");
const orderModel = require("../../model/order");
const userModel = require("../../model/user");
const withdrawModel = require("../../model/withdraw");

const login=()=>{
    try {
        
    } catch (error) {
        
    }
}

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
        const companyAddress = await companyAddressesModel.find({})
        res.status(200).json({success: true,result : companyAddress})
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
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

    changeUserEmail
}