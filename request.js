var request = require('request')
const fs = require('fs')
const ws = fs.createWriteStream('11.jpg')

let data = {
  name: 'xxxx'
}
request(
  {
    method: 'GET',
    uri: 'http://img.zcool.cn/community/01f09e577b85450000012e7e182cf0.jpg@1280w_1l_2o_100sh.jpg',

  }, (error, response, body) => {
    if (error) return
    // body is the decompressed response body
    console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
    data.age = 18
  }
)
  .on('data', function (data) {
    // decompressed data as it is received
    // console.log('decoded chunk: ' + data)
    // console.log(22222);
    ws.write(data)
  })
  .on('response', function (response) {
    // unmodified http.IncomingMessage object
    res = response
    console.log(1111);
    // ws.write(response)
    // response.on('data', function (data) {
    //   // compressed data as it is received
    //   console.log(11111);
    //   // ws.write(data)
    //   // console.log('received ' + data.length + ' bytes of compressed data')
    // })
  })



fs.stat('1.txt', function (err, stats) {
  console.log(stats);
})
