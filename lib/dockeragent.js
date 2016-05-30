import http from 'http'
import stream from 'stream'
import readline from 'readline'
import events from 'events'
import { HttpStatusError } from 'lib/error'

/*
 * This class uses a transform as input inot which user write data, and redirect data
 * to readline, emit parsed json object 
 */
class connection extends events {

  constructor(response) {
    super() 
    this.response = response
    this.transform = new stream.Transform({ 
      transform: function (chunk, encoding, callback) {
        this.push(chunk)
        callback()
      }
    })

    this.rl = readline
      .createInterface({input: this.transform})
      .on('line', (line) => {
        let json = null
        try {
          json = JSON.parse(line)
          this.emit('json', json)
        }
        catch (e) {
          // this.emit('error', new JSONParserError(e))
          // console.log(e)
          console.log(line)
        } 
      })
      .on('close', () => {
        this.emit('close') 
      })

    response.setEncoding('utf8')
    response.on('data', chunk => this.transform.write(chunk))
    response.on('end', () => this.transform.end()) 
  }
}

/*
 * This class holds a request object, and delegate connection events to user, if connected.
 */
class agent extends events {

  constructor(method, path, callback) { 
    super()
    let options = {
      hostname: '127.0.0.1',
      port: 1688,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    }

    this.aborted = false
    this.closed = false

    this.req = http
      .request(options, (res) => { 
        if (res.statusCode === 200) {    
          let conn = new connection(res)
          conn.on('json', data => this.emit('json', data))
          conn.on('close', () => {
            this.closed = true
            this.emit('close')
          })
          callback(null, this)
        }
        else {
          callback(new HttpStatusError(res.statusCode))
        }
      }) // dont chain
    this.req.on('error', e => callback(e))
    this.req.end() 
  }
  
  abort() {
    this.aborted = true
    this.req.abort()
  }
}

/** the agent emit HttpStatusError / errno: EHTTPSTATUS **/
const get = (path, callback) => new agent('GET', path, callback)  
const post = (path, callback) => new agent('POST', path, callback)

export default {get, post}

/**
get('/events', (err, agent) => {

  if (err) {
    console.log(err)
    return
  }

  agent.on('json', data => console.log(data))
  agent.on('close', () => console.log('close'))

  setTimeout(() => agent.abort(), 30000)
})
**/


