const path = require('path')
const fs = require('fs')
const child = require('child_process')

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

/**
const parseIdentifyOutput = data => {

  let split = data.toString().split('|').map(str => str.trim())
  if (split.length !== 8) return

  let obj = {}  

  // 0: format
  if (split[0] === 'JPEG')
    obj.format = 'JPEG'
  else 
    return

  // 1: width
  let width = parseInt(split[1])
  if (Number.isInteger(width) && width > 0)
    obj.width = width
  else
    return

  // 2: height
  let height = parseInt(split[2])
  if (Number.isInteger(height) && height > 0)
    obj.height = height
  else 
    return

  // 3: exifOrientation (optional) 
  let orient = parseInt(split[3])
  if (Number.isInteger(orient))
    obj.exifOrientation = orient

  // 4: exifDateTime (optional)
  if (validateExifDateTime(split[4]))
    obj.exifDateTime = split[4]

  // 5: exifMake
  if (split[5].length > 0)
    obj.exifMake = split[5]

  // 6: exifModel
  if (split[6].length > 0)
    obj.exifModel = split[6]

  let size
  if (split[7].endsWith('B')) 
    size = parseInt(split[7])
  if (Number.isInteger(size) && size > 0)
    obj.size = size
  else 
    return

  return obj 
}
**/

const identify = (filePath, hash, uuid, callback) => {

  let cmd
  let destroyed = false

  readXstat(filePath, (err, xstat) => {
    if (destroyed) return
    if (err) return callback(err)
    if (xstat.type !== 'file') return callback(new Error('not a file'))
    if (xstat.uuid !== uuid) return callback(new Error('uuid mismatch'))
    if (xstat.hash !== hash) return callback(new Error('fingerprint mismatch'))
    
    child.exec(`identify -format '${identifyFormatString}' '${filePath}'`, (err, stdout) => {
      if (destroyed) return
      if (err) return callback(err)
      let metadata = parseIdentifyOutput(stdout)
      if (metadata) {
        // callback(null, Object.assign({ hash }, metadata))
        callback(null, metadata)
      }
      else 
        callback(new Error('failed to parse identify output'))
    })
  })
  
  return { 
    destroy () {
      destroyed = true
    }
  }
}
  
module.exports = identify




