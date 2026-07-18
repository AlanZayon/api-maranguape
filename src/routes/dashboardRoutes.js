const express = require('express');
const { authenticate } = require('../middlewares/auth');
const DashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', authenticate, DashboardController.summary);

module.exports = router;
