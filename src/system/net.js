const path = require('path')
const fs = require('fs')
const os = require('os')

/**
Pure function for retrieving network interfaces information from sys fs

@module networkInterfaces
*/


const classNetPath ='/sys/class/net'

const autoInt = (string) => parseInt(string).toString() === string ? parseInt(string) : string

const formatFileValue = (value) => {

  let arr = value.toString().trim().split('\n')

  // if all have key=value format, return an object
  if (arr.every(item => (item.match(/=/g) || []).length === 1)) {
    let object = {}
    arr.forEach(item => object[item.split('=')[0]] = autoInt(item.split('=')[1]))
    return object
  }

  arr = arr.map(item => autoInt(item))

  // otherwise return single string or string array
  return arr.length === 1 ? arr[0] : arr
}

const objectify = (dirPath, callback) => {

  let object = {}
  fs.readdir(dirPath, (err, entries) => {

    if (err) return callback(err) 
    if (entries.length === 0) return callback(null, {})
   
    let count = entries.length 
    let stats = []
    entries.forEach(entry => {

      let entryPath = path.join(dirPath, entry)
      fs.lstat(entryPath, (err, stat) => {

        const finish = () => !--count && callback(null, object)

        if (err) return finish()
        if (stat.isFile()) 
          fs.readFile(entryPath, (err, data) => {
            if (!err) object[entry] = formatFileValue(data)
            finish()
          })
        else if (stat.isSymbolicLink())

          fs.readlink(entryPath, (err, linkString) => {

            if (err) return finish()
            if (entry !== 'phy80211') {
              object[entry] = linkString.toString()
              return finish()
            }

            objectify(entryPath, (err, obj) => {

              if (err) return finish()
              object[entry] = obj
              return finish()
            }) 
          })
        else if (stat.isDirectory())
          objectify(entryPath, (err, obj) => {
            if (!err) object[entry] = obj
            finish()
          })
        else
          finish()
      })  
    })
  })
}

const enumerate = callback => fs.readdir('/sys/class/net', (err, entries) => {

  let count

  if (err) return callback(err)
  if (entries.length === 0) return callback(null, [])

  count = entries.length
  let links = []
  entries.forEach(entry => fs.lstat(path.join('/sys/class/net', entry), (err, stat) => {

    if (!err && stat.isSymbolicLink()) links.push(entry)
    if (!--count) {

      if (links.length === 0) return callback(null, [])

      count = links.length 
      let nonvirts = []
      links.forEach(link => fs.readlink(path.join('/sys/class/net', link), (err, linkString) => {

        if (!err && !linkString.startsWith('../../devices/virtual')) nonvirts.push(link)
        if (!--count) {

          if (nonvirts.length === 0) return callback(null, [])

          count = nonvirts.length 
          let arr = []
          nonvirts.forEach(name => objectify(path.join('/sys/class/net', name), (err, object) => {

            if (!err) arr.push(Object.assign({ name }, object))
            if (!--count) callback(null, arr)
          }))

        }
      }))
    }
  }))
}) 

const interfaces = callback => enumerate((err, interfaces) => {

  if (err) return callback(err)

  let its = interfaces.map(it => ({
    name: it.name,
    address: it.address,
    mtu: it.mtu,
    speed: it.speed, 
    wireless: !!it.wireless,
    state: it.operstate
  }))

  let obj = os.networkInterfaces()

  Object.keys(obj).forEach(key => {

    if (key.endsWith(':app')) {

      let orig = key.slice(0, -4)
      let it = its.find(i => i.name === orig)
      if (it) it.ipAliases = obj[key]
    }
    else {

      let it = its.find(i => i.name === key)
      if (it) it.ipAddresses = obj[key]
    }
  })

  callback(null, its)
})


