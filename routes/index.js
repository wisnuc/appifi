var express = require('express');
var router = express.Router();
var path = require('path')

/* GET home page. */
router.get('/', function(req, res, next) {
 
  res.set('Content-Type', 'text/html')
  res.sendFile(path.join(__dirname, '../public/index.html'))
});

module.exports = router;
