const request = require('superagent')

request
  .post('http://localhost:12345')
  .field('size', 39499)
  .field('hello', JSON.stringify({ name: 'whatever' }))
  .field('hello', 'world')
  .attach('charcol', 'testdata/alonzo_church.jpg', JSON.stringify({ name: 'sax' }))
  .end((err, res) => console.log(err || res.body))

