const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const request = require('request')
const UUID = require('uuid')

const tmptest = path.join(process.cwd(), 'tmptest')
mkdirp.sync(tmptest)

if (!process.argv[2]) process.exit()

let stream = fs.createReadStream(process.argv[2])
let req = request.put(`http://localhost:4005/upload?path=${path.join(tmptest, UUID.v4())}`, (err, res, body) => console.log(err || res))

stream.pipe(req)


