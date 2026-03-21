const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const adminModel = require("../../model/admin");
const userModel = require("../../model/user");
const depositModel = require("../../model/deposit");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");

const fetchDeposits=async(req,res)=>{
    try {
        let documentIds = [];   
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const matchedOrders = await depositModel
                .find({ transactionId: searchRegex })
                .select('_id');
            documentIds = matchedOrders.map((u) => u._id);
        }    

        const { query, skip, limit, page } = buildPaginatedQuery(
            req.query,
            ['transactionId'],
            { documentIds }
        );
        
        // Total count for pagination
        const total = await depositModel.countDocuments(query);
        
        // Paginated results
        const data = await depositModel
            .find(query)
             .populate([
                { path: 'recieveAddress', select: 'address name priority' }, 
                { path: 'userId', select: 'email phone' }           
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalDepositedAmount = 0

        return res.status(200).json({ 
            success: true,
            result : data,
            total,
            currentPage:page,
            totalDepositedAmount
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({success : false,message : "Server error"})
    }
}


// Helper: generate a short unique transaction ID
const generateTransactionId = () => {
  const number = Math.floor(100000 + Math.random() * 900000);
  const time = Date.now().toString().slice(-4); // last 4 digits of timestamp
  return `ADM${time}${number}`; // ADM + 10 digits total
};

const addDepositsToUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, amount, comment, transactionPin } = req.body;

    // ── 1. Validate required fields ───────────────────────────────────
    if (!email || !amount || !transactionPin) {
      return res.status(400).json({
        success: false,
        message: "Email, amount, and transaction PIN are required.",
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number.",
      });
    }

    // ── 2. Verify Admin transaction PIN ───────────────────────────────
    // req.adminId is set by your auth middleware
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

    // ── 4. Create deposit record ──────────────────────────────────────
    // depositModel requires a recieveAddress (ObjectId ref to companyaddress).
    // For admin-injected funds we use a sentinel admin address doc, or you can
    // make recieveAddress optional for ADMIN paymentMode — adjust the schema if needed.
    const transactionId = generateTransactionId();

    const [deposit] = await depositModel.create(
      [
        {
          userId: user._id,
          paymentMode: "ADMIN",          // extend enum in depositSchema if needed
          status: "success",             // admin additions are immediately confirmed
          amount: parsedAmount,
          transactionId,
          txid: transactionId,           // use generated ID as txid for traceability
          recieveAddress: admin._id,     // sentinel — replace with a real address _id if schema enforces the ref
          ...(comment && { comment }),
        },
      ],
      { session }
    );

    // ── 5. Credit user balance ────────────────────────────────────────
    await userModel.findByIdAndUpdate(
      user._id,
      {
        $inc: {
          totalBalance: parsedAmount,
          availableBalance: parsedAmount,
        },
      },
      { session }
    );

    // ── 6. Update admin totals ────────────────────────────────────────
    await adminModel.findByIdAndUpdate(
      admin._id,
      {
        $inc: {
          totalDeposits: parsedAmount,
        },
      },
      { session }
    );

    // ── 7. Commit ─────────────────────────────────────────────────────
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `$${parsedAmount} successfully added to ${user.email}'s wallet.`,
      data: {
        transactionId: deposit.transactionId,
        userId: user._id,
        email: user.email,
        amount: parsedAmount,
        newAvailableBalance: user.availableBalance + parsedAmount,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("addDepositsToUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Transaction rolled back.",
    });
  } finally {
    session.endSession();
  }
};

const fetchDepositStats = async (req, res) => {
  try {
    const { from, to } = req.query;
 
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to)   dateFilter.createdAt.$lte = new Date(to);
    }
 
    const agg = await depositModel.aggregate([
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
      totalDeposited: 0,
    };
 
    agg.forEach(({ _id, count, amount }) => {
      if (_id && stats[_id] !== undefined) {
        stats[_id] = {
          count,
          amount: Math.round(amount * 100) / 100,
        };
      }
    });
 
    // totalDeposited = all-time success (ignore date filter for this one)
    const totalAgg = await depositModel.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]);
    stats.totalDeposited = Math.round((totalAgg[0]?.total || 0) * 100) / 100;
 
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('fetchDepositStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
module.exports = {
    fetchDeposits,
    addDepositsToUser,
    fetchDepositStats
}