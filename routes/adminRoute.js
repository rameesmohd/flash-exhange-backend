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
const Dashboard = require('../controllers/admin/dashboardStatus')

router.post('/login',adminController.login);

router.use(verifyUser);

router.get("/dashboard/stats",Dashboard.getDashboardStats );

router.get('/users', adminController.fetchUsers);
router.post('/change-email', adminController.changeUserEmail);

router.route('/address')
  .get(adminController.fetchCompanyAddress)
  .post(adminController.addCompanyAddress)
  .patch(adminController.updateAddress);
  
router.patch(   '/fund/reorder', fundController.reorderFunds );  

router.route (  '/fund' )
      .get   (  fundController.fetchFunds )
      .post  (  fundController.addFunds   )
      .patch (  fundController.updateFund )
router.patch (  '/fund/:id/update-status',        fundController.updateFundStatus  );
router.get   (  '/fund/:id/allowed-users',        fundController.getAllowedUsers   );
router.post  (  '/fund/:id/allowed-users',        fundController.addAllowedUsers   );
router.delete(  '/fund/:id/allowed-users',        fundController.removeAllowedUser );
router.patch (  '/fund/:id/allowed-users/clear',  fundController.clearAllowedUsers );

router.get("/orders/stats",orderController.fetchOrderStats)

router.route('/orders/:orderId/screenshots')
  .post(orderController.uploadPaymentScreenshot)
  .delete(orderController.deleteReceiptUploaded)

router.route('/order/:orderId/add-payment')
  .patch(orderController.addPayment)

router.route('/orders')
  .get(orderController.fetchOrders)
  .patch(orderController.handleOrderStatus);

router.get('/deposits', depositController.fetchDeposits);
router.get("/deposits/stats", depositController.fetchDepositStats );

router.route('/withdrawals')
  .get(withdrawelController.fetchWithdrawals)
  .patch(withdrawelController.handleWithdrawStatus);

router.get("/withdrawals/stats", withdrawelController.fetchWithdrawalStats );
    
router.post('/delete-image',orderController.deleteImage)

router.post('/add-to-wallet',depositController.addDepositsToUser)


module.exports = router;
