import stream from 'stream'
import readline from 'readline'
import events from 'events'

import Debug from 'debug'
const TRANSFORM = Debug('APPIFI:TRANSFORM')

/*
 * This class uses a transform as input into which user write data, and redirect data
 * to readline, emit parsed json object 
 */
class Transform extends events {

  constructor(response) {
    super() 
    this.transform = new stream.Transform({ 
      transform: function (chunk, encoding, callback) {
        this.push(chunk)
        callback()
      }
    })

    readline
    .createInterface({input: this.transform})
    .on('line', (line) => {
      let json = null
      try {
        json = JSON.parse(line)
        this.emit('json', json)
      }
      catch (e) {
        TRANSFORM(line)
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

export { Transform }