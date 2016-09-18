import fs from 'fs'

var EventEmitter = require('events')
var child = require('child_process')

class HashMagic extends EventEmitter {

  constructor() {
    super()
    this.clear()
  }

  // internal method
  clear() {
    this.target = null
    this.uuid = null
    this.timestamp = null

    this.hashSpawn = null
    this.hash = null
    this.hashExitCode = null

    this.magicSpawn = null
    this.magic = null
    this.magicExitCode = null
    this.state = 'IDLE' // or BUSY
  }

  // start the worker
  start(target, uuid) {

    if (this.state !== 'IDLE') return

    console.log(`[hashMagicWorker]: ${target} ${uuid}`)
    this.state = 'BUSY'
    this.target = target
    this.uuid = uuid

    fs.stat(target, (err, stats) => {

      if (err) return this.end({ err })

      if (!stats.isFile()) {
        let err = new Error('target must be file')
        err.code = 'EINVAL'
        return this.end({ err })
      }

      // record timestamp
      this.timestamp = stats.mtime.getTime()

      this.hashSpawn = child.spawn('openssl', ['dgst', '-sha256', '-r', this.target])
      this.hashSpawn.stdout.on('data', data => {
        if (this.state !== 'BUSY') return
        let hash = data.toString().trim().split(' ')[0]
        this.hash = hash
      })

      this.hashSpawn.on('close', code => {
        this.hashSpawn = null
        if (this.state !== 'BUSY') return
        if (code === 0 && this.magicExitCode === 0) 
          this.end()
        else if (code !== 0)
          this.end(new Error(`openssl exit code ${code}`))
        else
          this.hashExitCode = code
      })
       
      this.magicSpawn = child.spawn('file', ['-b', this.target])
      this.magicSpawn.stdout.on('data', data => {
        if (this.state !== 'BUSY') return
        let magic = data.toString().trim()
        this.magicSpawn = null
        this.magic = magic
      })

      this.magicSpawn.on('close', code => {
        this.magicSpawn = null
        if (this.state !== 'BUSY') return
        if (code === 0 && this.hashExitCode === 0) 
          this.end()
        else if (code !== 0) 
          this.end(new Error(`file exit code ${code}`))
        else
          this.magicExitCode = code
      })
    })
  }

  // abort current job, won't fire 'end' 
  abort() {

    if (this.state !== 'BUSY') return
    if (this.hashSpawn) 
      this.hashSpawn.kill()
    if (this.magicSpawn)
      this.magicSpawn.kill()

    let error = new Error('hash magic job aborted')
    error.code = 'EABORT'
    this.end(error)
  }

  end(err) {
    let ret
    if (err) 
      ret = { err, uuid: this.uuid, target: this.target }
    else
      ret = { err: null, uuid: this.uuid, target: this.target, hash: this.hash, magic: this.magic, timestamp: this.timestamp }

    // unwind the stack
    process.nextTick(() => this.emit('end', ret))
    this.clear()
  }
}

export default () => new HashMagic()

