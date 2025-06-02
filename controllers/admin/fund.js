const fundModel = require("../../model/fund");

const fetchFunds = async(req,res)=>{
    try {
        const funds = await fundModel.find().sort({ createdAt: -1 });
        res.status(200).json({funds,success: true})
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

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

module.exports = {
    addFunds,
    fetchFunds,
    updateFundStatus,
    updateFund
}