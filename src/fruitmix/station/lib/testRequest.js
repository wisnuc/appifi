const request = require('./request').requestHelperAsync

let blob = {
  name: 'CJackYang',
  badge: 1,
  content: 'Hello JackYang',
  isloved: true,
  readCount: 1,
  type: 'String'
}

request('POST', 'http://www.jackyang.cn/blobs', { params: blob }, { 'Content-Type': 'application/json'})
  .then(res => {
    console.log(res.body)
    console.log(res.status)
  })
  .catch(console.error.bind(console))