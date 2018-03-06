const EventEmitter = require('events')
const spawn = require('child_process').spawn

const kMap = new Map([
  ['ImageWidth', 'w'],
  ['ImageHeight', 'h'],
  ['Orientation', 'orient'],
  ['CreateDate', 'date'],
  ['CreationDate', 'datec'],
  ['Make', 'make'],
  ['Model', 'model'],
  ['GPSPosition', 'gps'],
  ['Duration', 'dur'],
  ['Rotation', 'rot'],
  ['FileSize', 'size'],
])

// accept zero-length output
const zSet = new Set([
  'Make',
  'Model'
])

// value is integer
const iSet = new Set([
  'w',
  'h',
  'size',
  'orient',
  'rot',
])

// value is float
const fSet = new Set([
  'dur'
])


const genArgs = (filePath, magic) => {
  let args = ['-S']
  if (magic === 'JPEG' || magic === 'PNG') {
    args.push('-ImageWidth')
    args.push('-ImageHeight')
    args.push('-Orientation#')
    args.push('-CreateDate')
    args.push('-CreationDate')
    args.push('-Make')
    args.push('-Model')
    args.push('-GPSPosition')
    args.push('-FileSize#')
  } else if (magic === 'GIF') {
    args.push('-ImageWidth')
    args.push('-ImageHeight')
    args.push('-FileSize#')
  } else if (magic === '3GP' || magic === 'MP4' || magic === 'MOV') {
    args.push('-ImageWidth')
    args.push('-ImageHeight')
    args.push('-CreateDate')  
    args.push('-CreationDate')
    args.push('-Make')
    args.push('-Model')
    args.push('-GPSPosition')
    args.push('-Duration#')
    args.push('-Rotation#')
    args.push('-FileSize#')
  }
  args.push(filePath)
  return args
}

const parse = (text, magic) => text
  .split('\n')
  .map(l => l.trim())
  .filter(l => !!l.length)
  .reduce((o, l) => {
    let idx = l.indexOf(':')
    if (idx === -1) {
      console.log('WARNING: token not found', l)
//      throw new Error('invalid format')
      return o
    }

    let k = l.slice(0, idx)
    let v = l.slice(idx + 2)
    if (k.length === 0) {
      console.log('WARNING: zero key length', l, k, v)
//      throw new Error('invalid key format')
      return o
    }

    if (v.length === 0) {
      if (zSet.has(k)) {
        return o 
      } else {
        console.log('WARNING: invalid value format, zero length value', l, k, v)
        // throw new Error('invalid value format')
        return o
      }
    }

    if (!kMap.has(k)) {
      let t = `WARNING: invalid key: ${k}`
      console.log(t)
      return o
    }

    let key = kMap.get(k)
    o[key] = iSet.has(key) 
      ? parseInt(v) 
      : fSet.has(key)
        ? parseFloat(v)
        : v

    return o
  }, { m: magic })


const exiftool = (filePath, magic, callback) => {

  let args = genArgs(filePath, magic)  
  let data = []
  let child = null

  const destroy = () => {
    if (!child) return
    child.stdout.removeAllListeners()
    child.removeAllListeners()
    child.on('error', () => {})
    child.kill()
    child = null
  }

  child = spawn('exiftool', args)
  child.stdout.on('data', x => data.push(x))
  child.on('error', err => (destroy(), callback(err)))
  child.on('close', (code, signal) => {
    child = null
    if (code || signal) {
      callback(new Error(`exiftool exited unexpected, code ${code}, signal ${signal}`))
    } else {
      try {
        if (data.length === 0) throw new Error('exiftool generates no output')
        callback(null, parse(Buffer.concat(data).toString(), magic)) 
      } catch (e) {

        console.log('error parsing exiftool output >>>>')
        console.log('message', e.message)
        console.log('output', data)
        console.log(Buffer.concat(data).toString())
        console.log('file path', filePath)
        console.log('args', args)
        console.log('error parsing exiftool output <<<<')

        callback(e)
      }
    }
  })

  return { path: filePath, magic, destroy }
} 

exiftool.genArgs = genArgs
exiftool.parse = parse
module.exports = exiftool



