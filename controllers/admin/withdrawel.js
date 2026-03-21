const { default: mongoose } = require("mongoose");
const withdrawModel = require("../../model/withdraw");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");
const userModel = require("../../model/user");

// const fetchWithdrawals = async(req,res)=>{
//     try {
//         let documentIds = [];   
//         if (req.query.search) {
//             const searchRegex = new RegExp(req.query.search, 'i');
//             const matchedOrders = await withdrawModel
//                 .find({ transactionId: searchRegex })
//                 .select('_id');
//             documentIds = matchedOrders.map((u) => u._id);
//         }    

//         const { query, skip, limit, page } = buildPaginatedQuery(
//             req.query,
//             ['transactionId'],
//             { documentIds }
//         );
        
//         console.log(query );

//         // Total count for pagination
//         const total = await withdrawModel.countDocuments(query);
        
//         // Paginated results
//         const data = await withdrawModel
//         .find(query)
//         .populate([
//             { path: 'userId', select: 'email phone' }           
//         ])
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit);

//         return res.status(200).json({ 
//             success: true,
//             result : data,
//             total,
//             currentPage:page,
//         })
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({success : false,message : "Server error"})
//     }
// }

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

/* ─────────────────────────────────────────────────────────────────────────────
   GET /withdrawals/stats?from=&to=
   Register BEFORE /withdrawals/:id in your router.
───────────────────────────────────────────────────────────────────────────── */
const fetchWithdrawalStats = async (req, res) => {
  try {
    const { from, to } = req.query;

    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to)   dateFilter.createdAt.$lte = new Date(to);
    }

    // Counts + amounts per status for the selected range
    const agg = await withdrawModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id:    '$status',
          count:  { $sum: 1 },
          amount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    const stats = {
      pending:        { count: 0, amount: 0 },
      success:        { count: 0, amount: 0 },
      failed:         { count: 0, amount: 0 },
      totalWithdrawn: 0,
    };

    agg.forEach(({ _id, count, amount }) => {
      if (_id && stats[_id] !== undefined) {
        stats[_id] = { count, amount: Math.round(amount * 100) / 100 };
      }
    });

    // All-time total withdrawn (success only, ignores date filter)
    const totalAgg = await withdrawModel.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]);
    stats.totalWithdrawn = Math.round((totalAgg[0]?.total || 0) * 100) / 100;

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('fetchWithdrawalStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /withdrawals
   Updated: search covers transactionId + userId.email, date filter is UTC-aware
───────────────────────────────────────────────────────────────────────────── */
const fetchWithdrawals = async (req, res) => {
  try {
    const {
      search = '',
      from,
      to,
      status,
      currentPage = 1,
      pageSize = 10,
    } = req.query;

    const page  = Math.max(1, parseInt(currentPage, 10));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
    const skip  = (page - 1) * limit;

    // Base query
    const query = {};
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   query.createdAt.$lte = new Date(to);
    }

    // Search: transactionId directly on withdrawModel,
    // email requires a $lookup — handle via two-step approach
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      // Find users matching email search
      const userModel = require('../models/userModel');
      const matchedUsers = await userModel
        .find({ email: searchRegex })
        .select('_id')
        .lean();
      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { transactionId: searchRegex },
        ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const [total, data] = await Promise.all([
      withdrawModel.countDocuments(query),
      withdrawModel
        .find(query)
        .populate([{ path: 'userId', select: 'email phone' }])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      result: data,
      total,
      currentPage: page,
    });
  } catch (error) {
    console.error('fetchWithdrawals error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
    fetchWithdrawals,
    handleWithdrawStatus,
    fetchWithdrawalStats
}