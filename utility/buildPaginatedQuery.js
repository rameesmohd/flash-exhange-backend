const buildPaginatedQuery = (reqQuery, allowedFilters = [],extraSearchConditions = {}) => {
    const {
      from,
      to,
      search = '',
      status='',
      currentPage = 1,
      pageSize = 10,
    } = reqQuery;
  
    const page = parseInt(currentPage);
    const limit = parseInt(pageSize);
    const skip = (page - 1) * limit;
  
    const query = {};
  
    // Date filter
    if (from && to) {
      query.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    // Status filter
    if (status) {
    query.status = status;
    }
  
     // Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      console.log(searchRegex , 'searchRegex');
      
      const orConditions = [];

      allowedFilters.forEach(field => {
        // if (field === 'email') {
        //   orConditions.push({ email: searchRegex });
        // }
        // if (field === 'orderId') {
        //   orConditions.push({ orderId: searchRegex });
        // }
        orConditions.push({ [field]: searchRegex });
      });

      // If you have additional search options like userId list
      if (extraSearchConditions.userIds && extraSearchConditions.userIds.length) {
        orConditions.push({ user: { $in: extraSearchConditions.userIds } });
      }

      if (orConditions.length) {
        query.$or = orConditions;
      }
    }
  
    return { query, skip, limit, page };
  };

  module.exports = {
    buildPaginatedQuery
  }