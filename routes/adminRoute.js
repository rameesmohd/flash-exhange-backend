const express = require('express');
const router = express.Router();
const { verifyUser } = require('../middleware/adminAuth');
const upload = require('../config/multer');

// Admin Controllers
const adminController = require('../controllers/admin/admin');
const fundController = require('../controllers/admin/fund');
const orderController = require('../controllers/admin/order');
const depositController = require('../controllers/admin/deposit');
const withdrawelController = require('../controllers/admin/withdrawel');


router.post('/login',adminController.login);

router.use(verifyUser);

// User Routes
router.get('/users', adminController.fetchUsers);
router.post('/change-email', adminController.changeUserEmail);

// Fund Address
router.route('/address')
  .get(adminController.fetchCompanyAddress)
  .post(adminController.addCompanyAddress)
  .patch(adminController.updateAddress);

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

router.route('/orders/:orderId/screenshots')
  .post(orderController.uploadPaymentScreenshot)
  .delete(orderController.deleteReceiptUploaded)

router.route('/order/:orderId/add-payment')
  .patch(orderController.addPayment)

// Deposit & Withdrawal Routes
router.get('/deposits', depositController.fetchDeposits);

router.route('/withdrawals')
  .get(withdrawelController.fetchWithdrawals)
  .patch(withdrawelController.handleWithdrawStatus);
    
router.post('/delete-image',orderController.deleteImage)

module.exports = router;
