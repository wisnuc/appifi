import http from 'http'
import events from 'events'

import Debug from 'debug'
const DOCKER_AGENT = Debug('APPIFI:DOCKER_AGENT')

import { Transform } from '../../lib/transform'
import { HttpStatusError } from '../../lib/error'
import DefaultParam from '../../lib/defaultParam'

let dockerURL = new DefaultParam().getDockerURL()

/*
 * This class holds a request object, and delegate connection events to user, if connected.
 */
class Agent extends events {

  constructor(method, path, callback) { 
    super()
    let options = {
      hostname: dockerURL.ip,
      port: dockerURL.port,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    }

    DOCKER_AGENT('Options value: ' + JSON.stringify(options))

    this.aborted = false
    this.closed = false

    this.req = http.request(options, (res) => { 
      if (res.statusCode === 200) {    
        let conn = new Transform(res)
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
const get = (path, callback) => {
  return new Agent('GET', path, callback)
}
const post = (path, callback) => {
  return new Agent('POST', path, callback)
}

export default { get, post }


