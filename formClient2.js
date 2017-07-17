const request = require('superagent')

const manifest = {
  hello: 'world',
  foo: 'bar',
  value: 12
}

/** 

name: 'dir', 'file'

{
  size: xxx,
  sha256: yes

  
}

1. create w/o overwrite; overwrite === true
2. create w/ overwrite; overwrite !== true
3. append 

**/

request
  .post('http://localhost:12345')
  .attach('file', 'testdata/alonzo_church.jpg')
  .attach('adobe', 'testdata/alonzo_church.jpg')
  .field('hello', 'whatever')
  .end((err, res) => console.log(err || res.body))

