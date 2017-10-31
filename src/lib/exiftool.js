const EventEmitter = require('events')
const spawn = require('child_process').spawn

const kMap = new Map([
  ['FileType', 'm'],
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

const iSet = new Set([
  'w',
  'h',
  'size',
  'orient',
  'rot',
])

const fSet = new Set([
  'dur'
])

class ExifTool extends EventEmitter {
  
  constructor(_path, magic) {
    super()
    this.path = _path
    this.magic = magic

    this.args = ['-S']

    if (this.magic === 'JPEG' || this.magic === 'PNG') {
      this.args.push('-FileType')
      this.args.push('-ImageWidth')
      this.args.push('-ImageHeight')
      this.args.push('-Orientation#')
      this.args.push('-CreateDate')
      this.args.push('-CreationDate')
      this.args.push('-Make')
      this.args.push('-Model')
      this.args.push('-GPSPosition')
      this.args.push('-FileSize#')
    } else if (this.magic === 'GIF') {
      this.args.push('-FileType')  
      this.args.push('-ImageWidth')
      this.args.push('-ImageHeight')
      this.args.push('-FileSize#')
    } else if (this.magic === '3GP' || this.magic === 'MP4' || this.magic === 'MOV') {
      this.args.push('-FileType')
      this.args.push('-ImageWidth')
      this.args.push('-ImageHeight')
      this.args.push('-CreateDate')  
      this.args.push('-CreationDate')
      this.args.push('-Make')
      this.args.push('-Model')
      this.args.push('-GPSPosition')
      this.args.push('-Duration#')
      this.args.push('-Rotation#')
      this.args.push('-FileSize#')
    }

    this.args.push(this.path)
    this.data = []

    this.child = spawn('exiftool', this.args)
    this.child.stdout.on('data', data => this.data.push(data))
    this.child.on('error', err => {
      this.destroy()
      this.emit('finish', err)
    })

    this.child.on('exit', (code, signal) => {
      this.child = null
      if (code || signal) {
        let text = `exiftool exited unexpectedly with code ${code} and signal ${signal}`
        this.emit('finish', new Error(text))
      } else {
        try {
          this.metadata = this.parse()
          this.emit('finish', null, this.metadata)
        } catch (e) {
          this.emit('finish', new Error('failed to parse exiftool output'))
        }
      }
    })
  }

  destroy () {
    if (this.child === null) return
    this.child.stdout.removeAllListeners()
    this.child.removeAllListeners()
    this.child.on('error', () => {})
    this.child.kill()
    this.child = null
  }

  parse () {
    let metadata = Buffer
      .concat(this.data)
      .toString()
      .split('\n')
      .map(l => l.trim())
      .filter(l => !!l.length)
      .reduce((o, l) => {
        let idx = l.indexOf(':')
        if (idx === -1) {
          console.log('token not found', l)
          throw new Error('invalid format')
        }

        let k = l.slice(0, idx)
        let v = l.slice(idx + 2)
        if (k.length === 0 || v.length === 0) {
          console.log('zero length', l, k, v)
          throw new Error('invalid format')
        }

        if (!kMap.has(k)) {
          let t = `invalid key: ${k}`
          console.log(t)
          throw new Error(t)
        }

        let key = kMap.get(k)
        o[key] = iSet.has(key) 
          ? parseInt(v) 
          : fSet.has(key)
            ? parseFloat(v)
            : v

        return o
      }, {})

    if (metadata.m !== this.magic) {
      let t = `exiftool reports different magic, expected ${this.magic}, actual ${metadata.m}`
      console.log(t, Buffer.concat(this.data).toString())
      throw new Error(t)
    }

    return metadata
  }
}

module.exports = ExifTool




