const fs = require('fs')
const ioctl = require('ioctl')
const mkdirp = require('mkdirp')

mkdirp.sync('tmptest')

const dst = fs.openSync('tmptest/dst', 'w+')
const oneGiga = fs.openSync('test-files/one-giga', 'r')
const oneGigaMinus = fs.openSync('test-files/one-giga-minus-1', 'r')

let buffer = Buffer.alloc(4 * 8)
buffer.writeInt32LE(oneGiga, 0) 

const IOC = 0x4020940D

ioctl(dst, IOC, buffer)

const size = fs.fstatSync(oneGigaMinus).size
console.log('size', size)

const remainder = size % 4096
const round = size - remainder
console.log('remainder', remainder)
console.log('round', round)

buffer = Buffer.alloc(4 * 8)
buffer.writeInt32LE(oneGigaMinus, 0)
buffer.writeUInt32LE(round, 16)
buffer.writeUInt32LE((1024 * 1024 * 1024), 24)

ioctl(dst, IOC, buffer)

if (remainder) {
  buffer = Buffer.alloc(remainder) 
  fs.readSync(oneGigaMinus, buffer, 0, remainder, round)
  fs.writeSync(dst, buffer, 0, remainder, (1024 * 1024 * 1024) + round)
}


