const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');

router.get('/autocomplete', SearchController.autocomplete);
router.get('/search-funcionarios', SearchController.searchFuncionarios);

module.exports = router;