const { default: mongoose } = require("mongoose");
const withdrawModel = require("../../model/withdraw");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");
const userModel = require("../../model/user");

const fetchWithdrawals = async(req,res)=>{
    try {
        let documentIds = [];   
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const matchedOrders = await withdrawModel
                .find({ transactionId: searchRegex })
                .select('_id');
            documentIds = matchedOrders.map((u) => u._id);
        }    

        const { query, skip, limit, page } = buildPaginatedQuery(
            req.query,
            ['transactionId'],
            { documentIds }
        );
        
        console.log(query );

        // Total count for pagination
        const total = await withdrawModel.countDocuments(query);
        
        // Paginated results
        const data = await withdrawModel
        .find(query)
        .populate([
            { path: 'userId', select: 'email phone' }           
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        return res.status(200).json({ 
            success: true,
            result : data,
            total,
            currentPage:page,
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}

const handleWithdrawStatus = async(req,res)=>{
   const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { status, id ,txid } = req.body;

    const validStatuses = ['success', 'failed', 'dispute'];
    if (!status || !id) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Both status and order ID are required.',
      });
    }

    if(status==='success' && !txid){
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Txid required.',
      });
    }

    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid status value.',
      });
    }

    const withdraw = await withdrawModel.findById(id).session(session);

    if (!withdraw) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Withdraw not found.',
      });
    }

    withdraw.status = status;
    withdraw.txid = txid
    await withdraw.save({ session });
    
    if (status === 'success') {
      const user = await userModel.findById(withdraw.userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      // Calculate new balances (rounded to 2 decimals)
      const processing = Number((user.processing - withdraw.amount).toFixed(2));
      const totalBalance = Number((processing + user.availableBalance).toFixed(2));
            console.log( 
                processing,
                totalBalance,
            );
      await userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            processing,
            totalBalance,
          },
        },
        { session }
      );
    }

    if (status === 'failed') {
      const user = await userModel.findById(withdraw.userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      // Calculate new balances (rounded to 2 decimals)
      const processing = Number((user.processing - withdraw.amount).toFixed(2));
      const availableBalance = Number((user.availableBalance + withdraw.amount).toFixed(2));
      const totalBalance = Number((processing + availableBalance).toFixed(2));
      console.log( processing,
            totalBalance,
            availableBalance);
      
      await userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            processing,
            totalBalance,
            availableBalance
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Withdraw status updated successfully.',
      withdraw,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating withdraw status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
}

module.exports = {
    fetchWithdrawals,
    handleWithdrawStatus
}