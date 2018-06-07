const FormData = require('form-data')
var fs = require('fs')
const path = require('path')

var form = new FormData()
form.append('1', fs.createReadStream(path.join(__dirname, '1.json')), JSON.stringify({
  op: 'newfile',
  size: 516,
  sha256: '5a9c70ceb688554c858d9d0a02c70805946684b61067caba1b6a30708e647d7c'
}))

form.append('2', fs.createReadStream(path.join(__dirname, '1.json')), JSON.stringify({
  op: 'newfile',
  size: 516,
  sha256: '5a9c70ceb688554c858d9d0a02c70805946684b61067caba1b6a30708e647d7c'
}))

console.log(form.getBoundary())

const ws = fs.createWriteStream(path.join(__dirname, '3'))

form.pipe(ws)
