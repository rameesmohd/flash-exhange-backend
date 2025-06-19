const { default: mongoose } = require("mongoose");
const orderModel = require("../../model/order");
const userModel = require("../../model/user");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");
const cloudinary = require("../../config/cloudinary");
const fs = require("fs");
const { orderCompleted, partialCompletion } = require("../../utility/mails");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_SECRET_KEY);


const fetchOrders=async(req,res)=>{
    try {
        let orderIds = [];   
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const matchedOrders = await orderModel
                .find({ orderId: searchRegex })
                .select('_id');
            orderIds = matchedOrders.map((u) => u._id);
        }    

        const { query, skip, limit, page } = buildPaginatedQuery(
            req.query,
            ['orderId'],
            { orderIds }
        );
          
        // Total count for pagination
        const total = await orderModel.countDocuments(query);
    
        // Paginated results
        const orders = await orderModel
            .find(query)
            .populate({ path: 'fund userId', select: 'type rate teleChannel email' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // const totalAmountAgg = await depositModel.aggregate([
        //     { $match: query },
        //     {
        //         $group: {
        //         _id: null,
        //         totalDepositedAmount: { $sum: { $toDouble: "$amount" } }
        //         }
        //     }
        // ]);
            
        const totalDepositedAmount = 0
        // totalAmountAgg[0]?.totalDepositedAmount || 0;

        return res.status(200).json({
            orders : orders,
            total, 
            currentPage: page,
            totalDepositedAmount
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({success: false,message : "Server error"})
    }
}

const uploadToCloudinary = (filePath) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        { folder: "screenshots", resource_type: "auto" },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            // 🔹 Delete local file after successful upload
            fs.unlink(filePath, (err) => {
              if (err) console.error("Failed to delete file:", err);
            });
            resolve(result.secure_url);
          }
        }
      );
    });
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
    const { status, id } = req.body;

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
        message: 'Invalid status value.',
      });
    }

    const order = await orderModel.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // if (order.status === 'success') {
    //   await session.abortTransaction();
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Order already marked as success.',
    //   });
    // }

    order.status = status;
    await order.save({ session });
    
    if (status === 'success') {
      const user = await userModel.findById(order.userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      // Calculate new balances (rounded to 2 decimals)
      const processing = Number((user.processing - order.usdt).toFixed(2));
      const totalBalance = Number((processing + user.availableBalance).toFixed(2));

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

      try {
        if (process.env.NODE_ENV === "production") {
          await resend.emails.send({
            from: process.env.NOREPLY_WEBSITE_MAIL,
            to: user.email,
            subject: `eValueTrade | Order Completed – Order ID: #${order.orderId}`,
            html: orderCompleted( order.orderId, order.fiat),
          });
        }    
      } catch (error) {
        console.log(error);
      }
    }

    if (status === 'failed') {
      const user = await userModel.findById(order.userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      // Calculate new balances (rounded to 2 decimals)
      const processing = Number((user.processing - order.usdt).toFixed(2));
      const availableBalance = Number((user.availableBalance + order.usdt).toFixed(2));
      const totalBalance = Number((processing + availableBalance).toFixed(2));

      await userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            processing,
            availableBalance,
            totalBalance,
          },
        },
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
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
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
            subject: `eValueTrade | Order Partially Completed – Order ID: #${order.orderId}`,
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



module.exports = {
    fetchOrders,
    handleOrderStatus,
    uploadPaymentScreenshot,
    deleteImage,
    deleteReceiptUploaded,
    addPayment
}