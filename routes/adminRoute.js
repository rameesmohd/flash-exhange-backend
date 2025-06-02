const express = require('express');
const router = express.Router();
const { verifyUser } = require('../middleware/adminAuth');

// Admin Controllers
const adminController = require('../controllers/admin/admin');
const fundController = require('../controllers/admin/fund');
const orderController = require('../controllers/admin/order');
const depositController = require('../controllers/admin/deposit');

// Optionally secure all routes
// router.use(verifyUser);

// User Routes
router.get('/users', adminController.fetchUsers);
router.post('/change-email', adminController.changeUserEmail);
router.get('/address', adminController.fetchCompanyAddress);

// Fund Routes
router.route('/fund')
  .get(fundController.fetchFunds)
  .post(fundController.addFunds)
  .patch(fundController.updateFund);

router.patch('/fund/:id/update-status', fundController.updateFundStatus);

// Order Routes
router.route('/orders')
  .get(orderController.fetchOrders)
  .patch(orderController.handleOrderStatus);

// Deposit & Withdrawal Routes
router.get('/deposits', depositController.fetchDeposits);

router.get('/withdrawals', adminController.fetchWithdrawals);

module.exports = router;
