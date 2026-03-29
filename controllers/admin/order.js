const { default: mongoose } = require("mongoose");
const orderModel = require("../../model/order");
const userModel = require("../../model/user");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");
const cloudinary = require("../../config/cloudinary");
const fs = require("fs");
const { orderCompleted, partialCompletion } = require("../../utility/mails");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_SECRET_KEY);
const roundTo2 = (n) => Math.round(n * 100) / 100;

function buildBaseQuery(reqQuery) {
  const { status, from, to } = reqQuery;
  const query = {};
 
  if (status) query.status = status;
 
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(to);
  }
 
  return query;
}

const fetchOrders = async (req, res) => {
  try {
    const {
      search     = '',
      fundType   = '',   // new: fund._id or 'all'
      currentPage = 1,
      pageSize    = 10,
    } = req.query;
 
    const page  = Math.max(1, parseInt(currentPage, 10));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
    const skip  = (page - 1) * limit;
 
    // Base query (status + date range — your existing buildBaseQuery)
    const baseQuery = buildBaseQuery(req.query);
 
    // ── Fund type filter ──────────────────────────────────────────
    // Frontend sends the fund's _id. We filter orders by fund field.
    if (fundType && fundType !== 'all') {
      baseQuery.fund = fundType;
    }
 
    // ── Search ────────────────────────────────────────────────────
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      baseQuery.$or = [
        { orderId: searchRegex },
        { 'bankCard.accountNumber': searchRegex },
        { 'bankCard.accountName':   searchRegex },
        { 'bankCard.upi':           searchRegex },
      ];
    }
 
    const [total, orders, completedAgg] = await Promise.all([
      orderModel.countDocuments(baseQuery),
 
      orderModel
        .find(baseQuery)
        .populate({ path: 'fund userId', select: 'type rate teleChannel email status code fundType' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
 
      orderModel.aggregate([
        { $match: { ...baseQuery, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$fiat' } } },
      ]),
    ]);
 
    const totalCompletedAmount = completedAgg[0]?.total || 0;
 
    return res.status(200).json({
      success: true,
      orders,
      total,
      currentPage: page,
      totalCompletedAmount,
    });
  } catch (error) {
    console.error('fetchOrders error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}

const uploadPaymentScreenshot = async (req, res) => {
  try {
    const { orderId } = req.params; 
    const { urls } = req.body; 

    console.log(orderId,urls);
    
    // 🔹 Push the URLs into the `receipts` array using $push + $each
    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id: orderId },
      {
        $push: {
          receipts: { $each: urls },
        },
      },
      { new: true }
    );

    return res.status(200).json({ success: true, result: updatedOrder });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteReceiptUploaded = async (req, res) => {
  try {
    const { url } = req.query;
    const { orderId } = req.params; 

    if (!orderId || !url) {
      return res.status(400).json({ success: false, message: 'Missing orderId or url' });
    }

    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      { $pull: { receipts: url } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, message: 'Receipt removed', order: updatedOrder });
  } catch (error) {
    console.error('delete error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const handleOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status, id, fulfilledFiat: rawFulfilledFiat, UTR: utr  } = req.body;

    // ── Validation ────────────────────────────────────────────────
    const validStatuses = ['success', 'failed', 'dispute'];

    if (!status || !id) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Both status and order ID are required.',
      });
    }

    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
      });
    }

    // UTR is required when marking an order as success
    if (status === 'success') {
      if (!utr || !String(utr).trim()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'UTR is required when marking an order as success.',
        });
      }

      // UTR format check — alphanumeric, 6–22 chars (covers NEFT/IMPS/UPI/RTGS)
      const utrClean = String(utr).trim();
      if (!/^[A-Za-z0-9]{6,22}$/.test(utrClean)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Invalid UTR format. Must be 6–22 alphanumeric characters.',
        });
      }

      // Check for duplicate UTR across all orders
      const duplicate = await orderModel
        .findOne({ UTR: utrClean, _id: { $ne: id } })
        .session(session)
        .lean();

      if (duplicate) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: `UTR "${utrClean}" is already linked to another order (#${duplicate.orderId}).`,
        });
      }
    }

    // ── Fetch order ───────────────────────────────────────────────
    const order = await orderModel.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!['pending', 'processing', 'dispute'].includes(order.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot update an order that is already "${order.status}".`,
      });
    }

    // ── Resolve fulfilledFiat ─────────────────────────────────────
    let resolvedFulfilledFiat = 0;

    if (status === 'success') {
      const parsed = parseFloat(rawFulfilledFiat);

      if (!rawFulfilledFiat || isNaN(parsed) || parsed <= 0) {
        resolvedFulfilledFiat = order.fiat;
      } else {
        resolvedFulfilledFiat = roundTo2(Math.min(parsed, order.fiat));
      }
    }

    // ── Update order ──────────────────────────────────────────────
    order.status = status;

    if (status === 'success') {
      order.fulfilledFiat = roundTo2(
        Math.min((order.fulfilledFiat || 0) + resolvedFulfilledFiat, order.fiat)
      );
      order.UTR = String(utr).trim();
    }

    await order.save({ session }); // pre-save hook recalculates fulfilledRatio

    // ── User balance updates ──────────────────────────────────────
    const user = await userModel.findById(order.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (status === 'success') {
      const processing   = roundTo2(user.processing - order.usdt);
      const totalBalance = roundTo2(processing + user.availableBalance);

      await userModel.updateOne(
        { _id: user._id },
        { $set: { processing, totalBalance } },
        { session }
      );

      try {
        if (process.env.NODE_ENV === 'production') {
          // await resend.emails.send({
          //   from: process.env.NOREPLY_WEBSITE_MAIL,
          //   to: user.email,
          //   subject: `FsQuickPay | Order Completed – Order ID: #${order.orderId}`,
          //   html: orderCompleted(order.orderId, order.fiat),
          // });
        }
      } catch (emailErr) {
        console.error('Email send failed (non-fatal):', emailErr);
      }
    }

    if (status === 'failed') {
      const processing       = roundTo2(user.processing - order.usdt);
      const availableBalance = roundTo2(user.availableBalance + order.usdt);
      const totalBalance     = roundTo2(processing + availableBalance);

      await userModel.updateOne(
        { _id: user._id },
        { $set: { processing, availableBalance, totalBalance } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('handleOrderStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const addPayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const { orderId } = req.params;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment amount" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Update fulfilledFiat with 2 decimal precision
    order.fulfilledFiat = Math.round((order.fulfilledFiat + Number(amount)) * 100) / 100;
    await order.save();

    if (process.env.NODE_ENV === "production") {
      const user = await userModel.findById(order.userId);
      if (user && user.email) {
        try {
          const fulfilledFiat = order.fulfilledFiat;
          const remainingFiat = Math.max(order.fiat - fulfilledFiat, 0);

          await resend.emails.send({
            from: process.env.NOREPLY_WEBSITE_MAIL,
            to: user.email,
            subject: `FsQuickPay | Order Partially Completed – Order ID: #${order.orderId}`,
            html: partialCompletion(
              user.name || 'Customer',
              order.orderId,
              fulfilledFiat,
              order.fiat,
              remainingFiat
            ),
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment added successfully",
      result: {
        fulfilledFiat: order.fulfilledFiat,
        orderId: order.orderId,
      },
    });
  } catch (error) {
    console.error("Add payment error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const fetchOrderStats = async (req, res) => {
  try {
    const { from, to } = req.query;
 
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to)   dateFilter.createdAt.$lte = new Date(to);
    }
 
    const agg = await orderModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count:  { $sum: 1 },
          amount: { $sum: '$fiat' },
        },
      },
    ]);
 
    // Shape into { pending: {count, amount}, success: {count, amount}, failed: {count, amount} }
    const stats = { pending: { count: 0, amount: 0 }, success: { count: 0, amount: 0 }, failed: { count: 0, amount: 0 } };
    agg.forEach(({ _id, count, amount }) => {
      if (_id && stats[_id] !== undefined) {
        stats[_id] = { count, amount: Math.round(amount * 100) / 100 };
      }
    });
 
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('fetchOrderStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportOrders = async (req, res) => {
  try {
    const { fundId, status, from, to } = req.query;
 
    const query = {};
 
    if (status && status !== 'all') query.status = status;
    if (fundId && fundId !== 'all') query.fund   = fundId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   query.createdAt.$lte = new Date(to);
    }
 
    const orders = await orderModel
      .find(query)
      .populate({ path: 'fund',   select: 'type rate code fundType' })
      .populate({ path: 'userId', select: 'email' })
      .sort({ createdAt: -1 })
      .lean();
 
    return res.status(200).json({ success: true, orders, total: orders.length });
  } catch (error) {
    console.error('exportOrders error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
    fetchOrders,
    handleOrderStatus,
    uploadPaymentScreenshot,
    deleteImage,
    deleteReceiptUploaded,
    addPayment,
    fetchOrderStats,
    exportOrders
}