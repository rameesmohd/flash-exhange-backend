const jwt = require('jsonwebtoken');
const adminModel = require('../model/admin');
const JWT_SECRET = process.env.JWT_SECRET_ADMIN

const  verifyUser = async(req, res, next) => {
  try {
    const token = req.cookies.adminToken;
    console.log(token);
    
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await adminModel.findById({_id :decoded._id});
    
    if (!admin || admin.currentToken !== token) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    const { currentToken, transactionPin,password, ...safeUser } = admin.toObject();
    req.admin = safeUser;
    next();
  } catch (error) {    
    if (error.name === 'TokenExpiredError') {
      console.log('TokenExpiredError');
      return res.status(401).json({ message: 'Authentication failed: Token has expired.' });
    }
    console.log(error);
    return res.status(401).json({ message: 'Authentication failed: something went error' });
  }
}

module.exports = {
  verifyUser
}