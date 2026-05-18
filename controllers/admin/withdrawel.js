const { default: mongoose } = require("mongoose");
const withdrawalModel = require("../../model/withdraw");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");
const userModel = require("../../model/user");
const adminModel = require('../../model/admin')
const bcrypt = require("bcrypt");

// Helper: generate a short unique transaction ID
const generateTransactionId = () => {
  const number = Math.floor(100000 + Math.random() * 900000);
  const time = Date.now().toString().slice(-4); // last 4 digits of timestamp
  return `ADM${time}${number}`; // ADM + 10 digits total
};

// const fetchWithdrawals = async(req,res)=>{
//     try {
//         let documentIds = [];   
//         if (req.query.search) {
//             const searchRegex = new RegExp(req.query.search, 'i');
//             const matchedOrders = await withdrawalModel
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
//         const total = await withdrawalModel.countDocuments(query);
        
//         // Paginated results
//         const data = await withdrawalModel
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

    const withdraw = await withdrawalModel.findById(id).session(session);

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
    const agg = await withdrawalModel.aggregate([
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
    const totalAgg = await withdrawalModel.aggregate([
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

    // Search: transactionId directly on withdrawalModel,
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
      withdrawalModel.countDocuments(query),
      withdrawalModel
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

const withdrawDepositsFromUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, amount, comment, transactionPin } = req.body;

    // ── 1. Validate required fields ───────────────────────────────────
    if (!email || !amount || !transactionPin) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Email, amount, and transaction PIN are required.",
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number.",
      });
    }

    // ── 2. Verify Admin transaction PIN ───────────────────────────────
    const admin = await adminModel.findById(req.admin._id).session(session);
    if (!admin) {
      await session.abortTransaction();
      return res.status(401).json({ success: false, message: "Admin not found." });
    }

    if (!admin.transactionPin) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Admin transaction PIN is not set. Please set a PIN before performing this action.",
      });
    }

    const isPinValid = await bcrypt.compare(String(transactionPin), admin.transactionPin);
    if (!isPinValid) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Invalid transaction PIN.",
      });
    }

    // ── 3. Find the target user ───────────────────────────────────────
    const user = await userModel.findOne({ email: email.toLowerCase().trim() }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `No user found with email: ${email}`,
      });
    }

    // ── 4. Check sufficient available balance ─────────────────────────
    // Only debit from availableBalance — never touch processing (locked in orders).
    if (user.availableBalance < parsedAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient available balance. User has $${user.availableBalance.toFixed(2)}, tried to withdraw $${parsedAmount.toFixed(2)}.`,
      });
    }

    // ── 5. Create withdrawal record ───────────────────────────────────
    const transactionId = generateTransactionId();

    const [withdrawal] = await withdrawalModel.create(
      [
        {
          userId: user._id,
          paymentMode: "ADMIN",          // extend enum in withdrawalSchema if needed
          status: "success",             // admin debits are immediately confirmed
          amount: parsedAmount,
          transactionId,
          txid: transactionId,
          receiveAddress: "Admin Adjustment",
          ...(comment && { comment }),
        },
      ],
      { session }
    );

    // ── 6. Debit user balance ─────────────────────────────────────────
    // Use a conditional update to prevent race condition where two concurrent
    // admin debits could both pass the balance check above.
    const debitResult = await userModel.findOneAndUpdate(
      { _id: user._id, availableBalance: { $gte: parsedAmount } },
      {
        $inc: {
          totalBalance: -parsedAmount,
          availableBalance: -parsedAmount,
        },
      },
      { session, new: true }
    );

    if (!debitResult) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Balance changed during transaction. Please retry.",
      });
    }

    // ── 7. Update admin totals ────────────────────────────────────────
    await adminModel.findByIdAndUpdate(
      admin._id,
      {
        $inc: {
          totalWithdrawals: parsedAmount,
        },
      },
      { session }
    );

    // ── 8. Commit ─────────────────────────────────────────────────────
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `$${parsedAmount} successfully withdrawn from ${user.email}'s wallet.`,
      data: {
        transactionId: withdrawal.transactionId,
        userId: user._id,
        email: user.email,
        amount: parsedAmount,
        newAvailableBalance: debitResult.availableBalance,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("withdrawDepositsFromUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Transaction rolled back.",
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
    fetchWithdrawals,
    handleWithdrawStatus,
    fetchWithdrawalStats,
    withdrawDepositsFromUser
}