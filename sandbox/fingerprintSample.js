const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const fps = require('../src/utils/fingerprintSimple')
const fpsAsync = Promise.promisify(fps)

let buf = Buffer.alloc(1024 * 1024 * 1024 + 1, 0xAA) 
fs.writeFileSync('tmpfile', buf) 

console.log('filling a file of 1024 * 1024 * 1024 + 1 bytes with 0xAA, the fingerprint should be:') 

fps('tmpfile', (err, fp) => console.log(err || fp))


