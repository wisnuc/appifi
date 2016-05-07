var express = require('express')
var router = express.Router()

// sadly, superagent does NOT support unix domain socket
// var request = require('request')
var request = require('superagent')

router.get('*', function(req, res, next) {

  // req.path holds path string starting with a slash
  // req.query holds query strings as an js object
  request
    .get('http://127.0.0.1:1688' + req.path)
    .query(req.query)
    .end((err, response) => {

      if (err) {
        console.log(err)
        return res.status(500).json(err)
      } 

      res.status(response.status)
        .type(response.header['content-type'])
        .send(response.body)
    })
});

module.exports = router;


