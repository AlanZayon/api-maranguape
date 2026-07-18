const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const SearchController = require('../controllers/searchController');

router.use(authenticate);

router.get('/autocomplete', SearchController.autocomplete);
router.get('/search-funcionarios', SearchController.searchFuncionarios);

module.exports = router;
