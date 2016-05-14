const http = require('http')
const stream = require('stream')
const readline = require('readline')
const EventEmitter = require('events')

class DockerAgent extends EventEmitter {

  constructor(_path) {
    super()

    let emitter = this

    this.transform = new stream.Transform({ 
      transform: function (chunk, encoding, callback) {
        this.push(chunk)
        callback()
      }
    })

    this.rl = readline
              .createInterface({input: this.transform})
              .on('line', (line) => {
                let msg = null
                try {
                  msg = JSON.parse(line)
                  emitter.emit('message', msg)
                }
                catch (e) {
                  emitter.emit('error', e)
                } 
              })
              .on('close', () => {
                emitter.emit('close') 
              })

    var options = {
      hostname: '127.0.0.1',
      port: 1688,
      path: _path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    }

    this.req = http
      .request(options, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => this.transform.write(chunk))
        res.on('end', () => this.transform.end())
      })
      .on('error', (e) => {
        emitter.emit('error', e)
      })

  } 

  start() {
    this.req.end()
  }

  abort() {
    this.req.abort()
  }
}

export default DockerAgent

