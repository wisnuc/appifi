const request = require('superagent')
const path = require('path')

const urlpath = path.join(__dirname, '/1.json')
console.log(urlpath)

// const deviceSN = '1plp0panrup3aaaa'
// const data = '%7B%22verb%22%3A%22POST%22%2C%22urlPath%22%3A%22%2Fdrives%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fdirs%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fentries%22%7D'
// const data = '{"verb":"POST","urlPath":"/drives/19bad6a0-7aed-427f-820f-0b067f259ee3/dirs/19bad6a0-7aed-427f-820f-0b067f259ee3/entries"}'
const url = 'http://sohon2test.phicomm.com/ResourceManager/app/pipe/resource?deviceSN=1plp0panrup3aaaa&data=%7B%22verb%22%3A%22POST%22%2C%22urlPath%22%3A%22%2Fdrives%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fdirs%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fentries%22%7D'

request
  .post(url)
  .set('Authorization', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjQifQ.eyJ1aWQiOiI4ODY0ODI2MiIsImNvZGUiOiJmZWl4dW4qMTIzLlNIXzIxNDk3NzMiLCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiaXNzIjoiUGhpY29tbSIsIm5iZiI6MTUyNjk1NTI4NCwiZXhwIjoxNTI3NDczNjg0LCJyZWZyZXNoVGltZSI6IjIwMTgtMDUtMjQgMTA6MTQ6NDQifQ.1NzA2wFcvtcbtqdbA-XV_2K9zlx6_KDjqFFsFxROOho')
  .attach('1', urlpath, JSON.stringify({
    op: 'newfile',
    size: 516,
    sha256: '5a9c70ceb688554c858d9d0a02c70805946684b61067caba1b6a30708e647d7c'
  }))
  .attach('2', urlpath, JSON.stringify({
    op: 'newfile',
    size: 516,
    sha256: '5a9c70ceb688554c858d9d0a02c70805946684b61067caba1b6a30708e647d7c'
  }))
  .end((err, res) => {
    console.log(err, res.text)
  })
