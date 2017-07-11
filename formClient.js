const request = require('superagent')

request
  .post('http://localhost:12345')
  .field('size', 39499)
  .attach('file', 'testdata/alonzo_church.jpg')
  .end((err, res) => console.log(err || res.body))

