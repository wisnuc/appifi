const request = require('./request')

request('GET', 'http://www.jackyang.cn/blobs', null, { 'Content-Type': 'application/json'}, (err, res) => {
  if(err) return console.log(err)
  console.log(res.body)
})