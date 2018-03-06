const script = `

let count = 0

const socket = new require('net').Socket({ fd: 0 })

socket.on('data', data => {
  count += data.length
})

setInterval(() => {
  console.log(Math.floor(count / (1024 * 1024)))
  count = 0
}, 1000)
`

const fs = require('fs')
const child = require('child_process')

let rs = fs.createReadStream('/dev/zero')
let proc = child.spawn('node', ['-e', script], {
  stdio: ['pipe', 'inherit', 'inherit']
})

rs.pipe(proc.stdio[0])

