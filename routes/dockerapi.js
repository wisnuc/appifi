var express = require('express')
var router = express.Router()

// sadly, superagent does NOT support unix domain socket
// var request = require('request')
var request = require('superagent')

router.get('*', function(req, res, next) {

  // req.path holds path string starting with a slash
  // req.query holds query strings as an js object
  var opts = {
    // url : 'http://unix:/var/run/docker.sock:' + req.path
    url : 'http://localhost:1234' + req.path
  }

  if (req.query)
    opts.qs = req.query

  // console.log(opts)

  /**
  request(opts, (err, msg, body) => {
    
    // res.status(msg.statusCode).json(body)
    console.log(err)
    console.log(body)
    res.status(msg.statusCode).send(body)
  })
  **/

  request
    .get('http://localhost:1234' + req.path)
    .query(req.query)
    .end((err, response) => {
      console.log(response)
      res
        .status(response.status)
        .type(response.header['content-type'])
        .send(response.body)
    })
});

module.exports = router;


