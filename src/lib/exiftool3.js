const child = require('child_process')

const verMap = new Map([
  ['JPG', 1],
  ['PNG', 1],
  ['BMP', 1],
  ['DOC', 1]
])

/**
This function validate metadata object in xattr

@param {object} metadata -
*/
const validate = metadata => {
  if (typeof metadata !== 'object' || !metadata) return false

  let ver = verMap.get(metadata.type)
  if (!ver) return false
  if (metadata.ver < ver) return false
  return true
}

const fileMeta = (path, callback) => child.exec(`exiftool '${path}'`, (err, stdout) => {
  if (err && err.code === 1) {
    callback(null)
  } else if (err) {
    callback(err)
  } else {
    let arr = stdout.split('\n')
      .map(l => l.trim())
      .filter(l => !!l.length)
      .filter(l => l.indexOf(':') !== -1)
      .map(l => {
        let index = l.indexOf(':')
        return [l.slice(0, index).trim(), l.slice(index + 1).trim()]
      })

    let map = new Map(arr)
    let type = map.get('File Type')
    let obj = {}

    const i = (key, name, format) => {
      if (!map.has(key)) return
      if (format === 'i') {
        obj[name] = parseInt(map.get(key))
      } else if (format === 'f') {
        obj[name] = parseFloat(map.get(key))
      } else {
        obj[name] = map.get(key)
      }
    }

    switch (type) {
      case 'JPEG':
        i('Image Width', 'w', 'i')
        i('Image Height', 'h', 'i')
        i('Orientation', 'orient')
        i('Create Date', 'date')
        i('Creation Date', 'datec')
        i('Make', 'make')
        i('Model', 'model')
        i('GPS Position', 'gps')
        i('Duration', 'dur')
        i('Rotation', 'rot')
        i('File Size', 'size')
        break
    
      case '':
        break
    }

    console.log(obj)
  }
})

fileMeta('testdata/vpai001.jpg', (err, data) => console.log(err || data))
