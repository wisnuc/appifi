
let request = require('superagent')

request
  .get('127.0.0.1:1688/info')
  .end(function(err, res){
    console.log(res.body)
  })

