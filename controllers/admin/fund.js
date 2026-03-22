const fundModel = require("../../model/fund");
const userModel  = require('../../model/user');

const fetchFunds = async (req, res) => {
  try {
    const funds = await fundModel
      .find({})
      .sort({ sortOrder: 1 }); // ← sortOrder only, no createdAt
 
    res.status(200).json({ funds, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addFunds = async(req,res)=>{
    try {
        const fund = await fundModel.create(req.body);
        res.status(201).json({ success: true, data: fund });
    } catch (error) {
        console.error('Create Fund Error:', error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const updateFundStatus = async(req,res)=>{
  const { id } = req.params;
  const { status } = req.body;

  try {
    const validStatuses = ['active', 'inactive', 'stockout'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({success:false, message: 'Invalid status value' });
    }

    const updatedFund = await fundModel.findByIdAndUpdate(id, { status }, { new: true });

    if (!updatedFund) {
      return res.status(404).json({ message: 'Fund not found' });
    }

    res.status(200).json({ success: true, data: updatedFund });
  } catch (error) {
    console.error('Error updating fund status:', error);
    res.status(500).json({ success:false, message: 'Server error' });
  }
}

const updateFund = async (req, res) => {
  try {
    const fund = await fundModel.findByIdAndUpdate(req.body.id, req.body.values, { new: true });
    if (!fund) return res.status(400).json({success:false, message: 'Fund not found' });
    res.status(200).json({ success: true, result: fund });
  } catch (err) {
    console.error(err);
    res.status(500).json({success:false, message: 'Server error' });
  }
};

const getAllowedUsers = async (req, res) => {
  try {
    const fund = await fundModel.findById(req.params.id).select('allowedUsers type code');
    if (!fund) return res.status(404).json({ success: false, message: 'Fund not found' });
    return res.status(200).json({ success: true, allowedUsers: fund.allowedUsers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
const addAllowedUsers = async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'emails array is required' });
    }
 
    const normalised = emails.map(e => e.toLowerCase().trim());
 
    // Validate: every email must belong to a real user
    const found = await userModel.find({ email: { $in: normalised } }).select('email');
    const foundEmails = found.map(u => u.email);
    const invalid = normalised.filter(e => !foundEmails.includes(e));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `These emails are not registered users: ${invalid.join(', ')}`,
      });
    }
 
    const fund = await fundModel.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { allowedUsers: { $each: normalised } } },
      { new: true }
    );
    if (!fund) return res.status(404).json({ success: false, message: 'Fund not found' });
 
    return res.status(200).json({ success: true, allowedUsers: fund.allowedUsers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
const removeAllowedUser = async (req, res) => {
  try {
    // Read from query param: DELETE /fund/:id/allowed-users?email=user@example.com
    const email = req.query.email || req.body?.email;

    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const fund = await fundModel.findByIdAndUpdate(
      req.params.id,
      { $pull: { allowedUsers: email.toLowerCase().trim() } },
      { new: true }
    );

    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund not found' });
    }

    return res.status(200).json({ success: true, allowedUsers: fund.allowedUsers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
const clearAllowedUsers = async (req, res) => {
  try {
    const fund = await fundModel.findByIdAndUpdate(
      req.params.id,
      { $set: { allowedUsers: [] } },
      { new: true }
    );
    if (!fund) return res.status(404).json({ success: false, message: 'Fund not found' });
    return res.status(200).json({ success: true, allowedUsers: [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 

const reorderFunds = async (req, res) => {
  try {
    const { orderedIds } = req.body;
 
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedIds array is required' });
    }
 
    // Run all updates in parallel — each fund gets sortOrder = its index
    await Promise.all(
      orderedIds.map((id, index) =>
        fundModel.findByIdAndUpdate(id, { sortOrder: index })
      )
    );
 
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('reorderFunds error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
    addFunds,
    fetchFunds,
    updateFundStatus,
    updateFund,

    getAllowedUsers,
    addAllowedUsers,
    removeAllowedUser,
    clearAllowedUsers,

    reorderFunds
}