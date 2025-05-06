const jwt = require('jsonwebtoken');
const userModel = require('../model/user')
const JWT_SECRET = process.env.JWT_SECRET

const  verifyUser = async(req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findById(decoded.userId);
    
    if (!user || user.currentToken !== token) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    req.user = user;
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