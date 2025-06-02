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

module.exports = {
    fetchDeposits
}