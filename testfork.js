const path = require('path')
const fs = require('fs')
const child = require('child_process')

const source = `

process.on('message', message => {
  console.log('-> ', message)
  process.send('reply: ' + message)
})

setTimeout(() => process.exit(1), 1234)

`

const modulePath = path.join('/', 'tmp', 'e5dcb8a1-cf29-4829-ba31-60056d195511')

fs.writeFileSync(modulePath, source)

let fork = child.fork(modulePath)

fork.on('message', message => console.log('<- ', message))
fork.on('error', err => console.log('fork error ::: ', err))
fork.on('exit', (code, signal) => {
  console.log('exit', code, signal)
  // console.log(fork)
})

fork.send('hello')

setTimeout(() => {
  fork.send('world')
  fork.kill()
  setTimeout(() => {
    fork.kill()
    fork.kill()
    fork.kill()
    setTimeout(() => {
      // console.log(fork)
      console.log('bye bye')
      process.exit(0)
    }, 5000)
  }, 3000)
}, 3000)

/**
ChildProcess {
  domain: null,
  _events: 
   { internalMessage: [Function],
     message: [Function],
     error: [Function],
     exit: [Function] },
  _eventsCount: 4,
  _maxListeners: undefined,
  _closesNeeded: 2,
  _closesGot: 2,
  connected: false,
  signalCode: 'SIGTERM',
  exitCode: null,
  killed: true,
  spawnfile: '/usr/bin/nodejs',
  _handle: null,
  spawnargs: 
   [ '/usr/bin/nodejs',
     '/tmp/e5dcb8a1-cf29-4829-ba31-60056d195511' ],
  pid: 1881,
  stdin: null,
  stdout: null,
  stderr: null,
  stdio: [ null, null, null, null ],
  channel: null,
  _channel: [Getter/Setter],
  _handleQueue: null,
  _pendingHandle: null,
  send: [Function],
  _send: [Function],
  disconnect: [Function],
  _disconnect: [Function] }
**/

/**
exit 1 null
ChildProcess {
  domain: null,
  _events: 
   { internalMessage: [Function],
     message: [Function],
     error: [Function],
     exit: [Function] },
  _eventsCount: 4,
  _maxListeners: undefined,
  _closesNeeded: 2,
  _closesGot: 1,
  connected: false,
  signalCode: null,
  exitCode: 1,
  killed: false,
  spawnfile: '/usr/bin/nodejs',
  _handle: null,
  spawnargs: 
   [ '/usr/bin/nodejs',
     '/tmp/e5dcb8a1-cf29-4829-ba31-60056d195511' ],
  pid: 1905,
  stdin: null,
  stdout: null,
  stderr: null,
  stdio: [ null, null, null, null ],
  channel: null,
  _channel: [Getter/Setter],
  _handleQueue: null,
  _pendingHandle: null,
  send: [Function],
  _send: [Function],
  disconnect: [Function],
  _disconnect: [Function] }
**/
