const child = require('child_process')

const ExifTool = require('./exiftool3')

const exiftool = new ExifTool()

/**
all versions starts from 2 for testing
*/
const nullType = {
  type: '_',
  ver: 2
}

Object.freeze(nullType)

/**
Declarative definition of each arg

[0] arg name
[1] arg suffix (format)
[2] prop name
[3] data type
*/
const argList = [
  ['ImageWidth', '', 'w', parseInt],
  ['ImageHeight', '', 'h', parseInt],
  ['Orientation', '#', 'orient', parseInt],
  ['CreateDate', '', 'date'],
  ['CreationDate', '', 'datec'],
  ['Make', '', 'make'],
  ['Model', '', 'model'],
  ['GPSPosition', '', 'gps'],
  ['Duration', '#', 'dur', parseFloat],
  ['PlayDuration', '#', 'dur', parseFloat],
  ['Rotation', '', 'rot', parseInt],
  ['Title', '', 'title'],
  ['Artist', '', 'artist'],
  ['Album', '', 'album'],
  ['Year',  '', 'year'],
  ['Genre', '', 'genre'] 
]

Object.freeze(argList)

/**

ImageWidth => {
  argString: '-ImageWidth',
  prop: 'w',
  parser: [function] || undefined
}

*/
const argMap = new Map()
argList.forEach(entry => {
  let [name, suffix, prop, parse] = entry
  argMap.set(name, Object.freeze({ argString: `-${name}${suffix}`, prop, parse }))
})

Object.freeze(argMap)

const stillImageProps = Object.freeze([
  'ImageWidth',
  'ImageHeight',
  'Orientation',
  'CreateDate',
  'CreationDate',
  'Make',
  'Model',
  'GPSPosition' 
])

const basicStillImageProps = Object.freeze([
  'ImageWidth',
  'ImageHeight'
])

const videoArgs = Object.freeze([
  'ImageWidth',
  'ImageHeight',
  'CreateDate',
  'CreationDate',
  'Make',
  'Model',
  'GPSPosition',
  'Duration',
  'PlayDuration',
  'Rotation'
])

const docArgs = Object.freeze([
])

const audioArgs = Object.freeze([
  'Title',
  'Artist',
  'Album',
  'Year',
  'Genre',
  'Duration',
  'PlayDuration'
])

const asfArgs = Object.freeze([
  
])

/**
Declarative definition of each type
*/
const typeList = [
  // image
  ['JPEG', 2, stillImageProps],
  ['PNG', 2, stillImageProps],
  ['GIF', 2, basicStillImageProps],
  ['BMP', 2, basicStillImageProps],
  ['TIFF', 2, basicStillImageProps],

  // video
  ['RM', 2, videoArgs],
  ['RMVB', 2, videoArgs],
  ['WMV', 2, videoArgs],
  ['AVI', 2, videoArgs],
  ['MPEG', 2, videoArgs],
  ['MP4', 2, videoArgs],
  ['3GP', 2, videoArgs],
  ['MOV', 2, videoArgs],
  ['FLV', 2, videoArgs],
  ['MKV', 2, videoArgs],

  // audio
  ['RA', 2, audioArgs],
  ['WMA', 2, audioArgs],
  ['MP3', 2, audioArgs],
  ['OGG', 2, audioArgs],
  ['MKA', 2, audioArgs],
  ['WAV', 2, audioArgs],
  ['APE', 2, audioArgs],
  ['FLAC', 2, audioArgs],

  // doc
  ['DOC', 2, docArgs],
  ['DOCX', 2, docArgs],
  ['XLS', 2, docArgs], 
  ['XLSX', 2, docArgs],
  ['PPT', 2, docArgs],
  ['PPTX', 2, docArgs],
  ['PDF', 2, docArgs]
]



/**

JPEG => {
  ver: 1,
  argList: [a, b, c],     // used in generating exiftool args
  argSet: Set { a, b, c } // used in checking parsed key
}

*/
const typeMap = new Map()
typeList.forEach(entry => {
  let [type, ver, argList] = entry
  typeMap.set(type, Object.freeze({ ver, argList, argSet: new Set(argList) }))
})

Object.freeze(typeMap)


/**
This function validate metadata object in xattr

@param {object} metadata -
*/
const validate = metadata => {
  if (!metadata || typeof metadata !== 'object') return false

  let { type, ver } = metadata
  if (type === '_') {
    return ver >= nullType.ver
  } else {
    if (!typeMap.has(type)) return false
    if (!Number.isInteger(ver)) return false
    if (ver < typeMap.get(type).ver) return false
    return true
  }
}

/**
*/
const genArgs = type => typeMap.get(type).argList
  .reduce((args, arg) => {
    args.push(argMap.get(arg).argString) 
    return args
  }, ['-S'])
  .join(' ')


/**
Returns a predefined type string, or undefined

`-S` for very short output
*/
const fileType = (path, callback) => 
//  child.exec(`exiftool -S -FileType '${path}'`, (err, stdout) => {
  exiftool.request(path, ['FileType'], (err, stdout) => {
    if (err && err.code === 1) {
      callback(null)
    } else if (err) {
      callback(err)
    } else {
      let s = stdout.toString()  
      let index = s.indexOf(':')
      if (index === -1) return callback(null)
      let type = s.slice(index + 1).trim()
      if (type === 'ASF') {
        // child.exec(`exiftool -S -VideoCodecName '${path}'`, (err, stdout) => {
        exiftool.request(path, ['VideoCodecName'], (err, stdout) => {
          if (err) {
            callback(err)
          } else {
            if (stdout.trim().length === 0) {
              callback(null, 'WMA')
            } else {
              callback(null, 'WMV')
            }
          }
        })
      } else if (typeMap.has(type)) {
        callback(null, type)
      } else {
        callback(null)
      }
    }
  }) 

/**
Return file meta object, if the type is not recognized, return nullType object

@param {string} path - file path
*/
const fileMeta = (path, callback) => 
  fileType(path, (err, type) => {
    if (err) return callback(err)
    if (!type || !typeMap.has(type)) return callback(null, nullType)

    let cmd = `exiftool ${genArgs(type)} ${path}`
    // child.exec(cmd, (err, stdout) => {
    exiftool.request(path, typeMap.get(type).argList, (err, stdout) => { 
      /**
      treat err.code === 1 as error, probably a race
      */
      if (err) return callback(err)
     
      let typeVal = typeMap.get(type)
      let obj = { type, ver: typeVal.ver  } 
      let dirty = true // TODO originally false, change to true for type only file such as pdf
      stdout.split('\n')
        .map(l => l.trim())
        .filter(l => !!l.length)
        .forEach(l => {
          let index = l.indexOf(':')
          if (index === -1) return

          // slice kv
          let [k, v] = [l.slice(0, index).trim(), l.slice(index + 1).trim()]
          if (!typeVal.argSet.has(k)) return

          let { prop, parse } = argMap.get(k)
          obj[prop] = parse ? parse(v) : v
          dirty = true
        })

      if (dirty) {
        callback(null, obj)
      } else {
        callback(null, nullType)      
      }
    })
  })

fileMeta.validate = validate
fileMeta.typeMap = typeMap
fileMeta.nullType = nullType

module.exports = fileMeta

