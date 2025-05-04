const jwt = require('jsonwebtoken');
const userModel = require('../model/user')
const JWT_SECRET = process.env.JWT_SECRET

const  verifyUser = async(req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findById(decoded.userId);
    console.log(user , "middleware");
    
    if (!user || user.currentToken !== token) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = {
  verifyUser
}