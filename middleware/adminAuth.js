const jwt = require('jsonwebtoken');
const adminModel = require('../model/admin');
const JWT_SECRET = process.env.JWT_SECRET

const  verifyUser = async(req, res, next) => {
  try {
    const token = req.cookies.token;
    // console.log(token);
    
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await adminModel.findById({_id :decoded.adminId});
    
    if (!admin || admin.currentToken !== token) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    const { currentToken, transactionPin, ...safeUser } = user.toObject();
    req.user = safeUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('TokenExpiredError');
      return res.status(401).json({ message: 'Authentication failed: Token has expired.' });
    }
    return res.status(401).json({ message: 'Authentication failed: something went error' });
  }
}

module.exports = {
  verifyUser
}