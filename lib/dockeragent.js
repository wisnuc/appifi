const http = require('http')
const stream = require('stream')
const readline = require('readline')
const EventEmitter = require('events')

class HttpRequestError extends Error {

  constructor(e) {
    super()
    this.code = e.code
  }
}

class HttpResponseError extends Error {

  constructor(res) {
    super()
    this.statusCode = res.statusCode
    this.statusMessage = res.statusMessage
  }
}

class JSONParserError extends Error {

  constructor(text) {
    super()
    this.text = text
  }
}

class DockerAgent extends EventEmitter {

  static get(_path) {
    let c = new DockerAgent(_path)
    c.on('error', () => {})
    return c
  }

  constructor(_path) {
    super()

    this.fired = false
    this.connected = false
    this.connectCallback = null
    this.disconnectCallback = null

    let self = this

    this.transform = new stream.Transform({ 
      transform: function (chunk, encoding, callback) {
        this.push(chunk)
        callback()
      }
    })

    this.rl = readline
              .createInterface({input: this.transform})
              .on('line', (line) => {
                if (!this.connected) return
                let msg = null
                try {
                  msg = JSON.parse(line)
                  self.emit('message', msg)
                }
                catch (e) {
                  self.emit('error', new JSONParserError(e))
                } 
              })
              .on('close', () => {
                if (!this.connected) return
                self.emit('disconnect') 
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
        if (res.statusCode === 200) {
          this.connected = true
          res.setEncoding('utf8')
          res.on('data', (chunk) => this.transform.write(chunk))
          res.on('end', () => this.transform.end())
          this.connectCallback(null, this)
        }
        else {
          // self.emit('error', new HttpResponseError(res))
          this.connectCallback(new HttpsResponseError(res))
        }
      })
      
    this.req.on('error', (e) => {
      // self.emit('error', new HttpRequestError(e))
      this.connectCallback(new HttpRequestError(e))
    })

    return this
  } 

  connect(callback) {
    this.req.end()
    this.fired = true
    this.connectCallback = callback 
    return this
  }

  disconnect() {
    this.req.abort()
    this.connected = false
    return this
  }
}

export default DockerAgent

/** sample
let conn = DockerAgent
            .get('/events')
            .on('message', (msg) => {
              console.log(msg)
            })
            .on('disconnect', () => {
              console.log('closed')
            })
            .connect((err) => {
              if (err) console.log(err)
              else console.log('connected')
            })
**/

