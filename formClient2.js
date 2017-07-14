const request = require('superagent')

const manifest = {
  hello: 'world',
  foo: 'bar',
  value: 12
}

request
  .post('http://localhost:12345')
  .field('manifest', JSON.stringify(manifest, null, ''))
  .field('size', 39499)
  .attach('file', 'testdata/alonzo_church.jpg')
  .field('hello', 'whatever')
  .end((err, res) => console.log(err || res.body))

