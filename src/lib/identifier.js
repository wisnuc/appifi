const path = require('path')
const fs = require('fs')
const child = require('child_process')

const Worker = require('./worker')
const E = require('./error')

const readXstat = require('./xstat').readXstat

// always 8 fields, trailing with size in bytes
// !!! don't double quote the string
// const identifyFormatString = '%m|%w|%h|%[EXIF:Orientation]|%[EXIF:DateTime]|%[EXIF:Make]|%[EXIF:Model]|%b'
/**
exif:GPSLatitude=31/1, 14/1, 206277/10000
exif:GPSLatitudeRef=N
exif:GPSLongitude=121/1, 34/1, 65881/10000
exif:GPSLongitudeRef=E
**/

const identifyFormatString= [
  '%m',                           // m
  '%w',                           // w
  '%h',                           // h
  '%[EXIF:Orientation]',          // orient
  '%[EXIF:DateTime]',             // datetime
  '%[EXIF:Make]',                 // make
  '%[EXIF:Model]',                // model
  '%[EXIF:GPSLatitude]',          // lat
  '%[EXIF:GPSLatitudeRef]',       // latr
  '%[EXIF:GPSLongitude]',         // long
  '%[EXIF:GPSLongitudeRef]',      // longr
  '%b'                            // size
].join('|')

// true indicates a number (not a string)
const DEF = [
  ['m'],
  ['w', true],
  ['h', true],
  ['orient', true],
  ['datetime'],
  ['make'],
  ['model'],
  ['lat'],
  ['latr'],
  ['long'],
  ['longr'],
  ['size', true]
]

const parseIdentifyOutput = data => data
  .toString()
  .split('|')
  .map(str => str.trim())
  .reduce((o, c, i) => c.length 
    ? Object.assign(o, { [DEF[i][0]]: DEF[i][1] ? parseInt(c) : c }) 
    : o, {})

const validateExifDateTime = str => {

  // "2016:09:19 10:07:05" 
  if (str.length !== 19)
    return false

  // "2016-09-19T10:07:05.000Z" this format is defined in ECMAScript specification, as date time string
  let dtstr = str.slice(0, 4) + '-' + str.slice(5, 7) + '-' + str.slice(8, 10) + 'T' + str.slice(11) + '.000Z' 
  return !isNaN(Date.parse(dtstr))
}

class Identify extends Worker {

  constructor(fpath, hash, uuid) {
    super()
    this.fpath = fpath
    this.uuid = uuid
    this.hash = hash
  }

  run () {
    readXstat(this.fpath, (err, xstat) => {

      if (this.finished) return
      if (err) return this.error(err)
      if (xstat.type !== 'file') return this.error(new E.ENOTFILE())
      if (xstat.uuid !== this.uuid) return this.error(new E.EINSTANCE())
      if (xstat.hash !== this.hash) return this.error(new E.ECONTENT()) 
      
      // !!! quote file path
      child.exec(`identify -format '${identifyFormatString}' '${this.fpath}'`, (err, stdout) => {
        if (this.finished) return
        if (err) return this.error(err)
        return (this.data = parseIdentifyOutput(stdout)) 
          ? this.finish(this.data)
          : this.error(new E.EPARSE()) 
      })
    })
  }
}

class Identifier {

  constructor() {
    this._exec = []
    this.exec = []
    this.xstat = []
    this.lstat = []
    this.concurrency = 16
  }

  schedule() {
    while (this._exec.length && this.exec.length < this.concurrency) {
      let x = this._exec.shift()
      this.exec.push(x)
      x.child = child.exec(`identify -format '${identifyFormatString}' '${x.path}'`, (err, stdout) => {

        let index = this.exec.indexOf(x) 
        if (index === -1) return
        this.exec.splice(index, 1)
        if (err) {
          x.callback(err)
        } else {
          x.metadata = parseIdentifyOutput(stdout)
          if (x.hash) {
            this.xstat.push(x) 
            readXstat(x.path, (err, xstat) => {
              let index = this.xstat.indexOf(x)
              if (index === -1) return
              this.xstat.splice(index, 1)
              if (xstat.uuid !== x.uuid) return callback(new Error('uuid mismatch'))
              if (xstat.hash !== x.hash) return callback(new Error('hash mismatch'))
              x.callback(null, Object.assign(x.metadata, { size: xstat.size }))
              this.schedule()
            })
          } else {
            this.lstat.push(x)
            fs.lstat(x.path, (err, stat) => {
              let index = this.lstat.indexOf(x)
              if (index === -1) return
              this.lstat.splice(index, 1)
              x.callback(null, Object.assign(x.metadata, { size: stat.size }))
              this.schedule()
            })
          }
        }
        this.schedule()
      }) 
    }
  }

  identify(fpath, hash, uuid, callback) {

    let x
    if (typeof hash === 'string') {
      x = { path: fpath, hash, uuid, callback }  
    } else {
      x = { path: fpath, callback }
    }
    this._exec.push(x)
    this.schedule()

    const pluck = arr => arr.splice(arr.indexOf(x), 1)

    return () => {
      pluck(this._exec)
      pluck(this.exec)
      pluck(this.xstat)
      pluck(this.lstat)
      this.schedule()
    }
  }
}

const identifier = new Identifier()

module.exports = identifier

