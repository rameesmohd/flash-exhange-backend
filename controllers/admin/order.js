const { default: mongoose } = require("mongoose");
const orderModel = require("../../model/order");
const userModel = require("../../model/user");
const { buildPaginatedQuery } = require("../../utility/buildPaginatedQuery");

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



module.exports = {
    fetchOrders,
    handleOrderStatus
}