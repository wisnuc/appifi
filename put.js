const fs = require('fs')
const request = require('superagent')

let stream = fs.createReadStream('./package.json')
let req = request.put('http://localhost:8964/file')

stream.pipe(req)


