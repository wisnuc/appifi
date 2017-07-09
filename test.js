const request = require('superagent')

request.post('http://localhost:1337')
  .field('hello', 'world')
  .attach('file', 'testdata/empty')
  .end((err, res) => console.log(err || res.body))

