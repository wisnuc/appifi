var path = require('path')
var os = require('os')

var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))

var classNetPath ='/sys/class/net'

const mapAsyncMapFilter = async (arr, asyncMapper, mapper, options) => 
  (await Promise.map(arr, item => asyncMapper(item).reflect(), options))
    .map((x, index) => x.isFulfilled() ? mapper(arr[index], x.value()) : null)
    .filter(x => !!x)

const enumerateNetworkInterfaceNamesAsync = async (dirpath) => {

  let entries = await fs.readdirAsync(dirpath)
  let interfaces = await mapAsyncMapFilter(entries,         // entries
    entry => fs.lstatAsync(path.join(dirpath, entry)),      // imapper, map entry to stat, async
    (entry, stat) => stat.isSymbolicLink() ? entry : null)  // omapper, select entry by stat 

  return await mapAsyncMapFilter(interfaces, 
    itfc => fs.readlinkAsync(path.join(dirpath, itfc)), 
    (itfc, link) => !link.startsWith('../../devices/virtual/') ? itfc : null)
}

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

const genKeyValuePair = (stat, value) => {
  if (stat.isFile()) 
    return { key: stat.entry, value: formatFileValue(value) } 
  else if (stat.isSymbolicLink()) 
    return { key: stat.entry, value: value.toString() } 
  else if (stat.isDirectory())
    return { key: stat.entry, value: value }
  else 
    return null 
}

const objectifyAsync = async (dirpath) => {

  let object = {}
  let entries = await fs.readdirAsync(dirpath)
  let stats = await mapAsyncMapFilter(entries, 
    entry => fs.lstatAsync(path.join(dirpath, entry)),
    (entry, stat) => Object.assign(stat, { entry }))

  let pairs = await mapAsyncMapFilter(stats,
    stat => {
      let entryPath = path.join(dirpath, stat.entry)
      if (stat.isFile()) 
        return fs.readFileAsync(entryPath)
      else if (stat.isSymbolicLink())
        return fs.readlinkAsync(entryPath)
      else if (stat.isDirectory())
        return Promise.resolve(objectifyAsync(entryPath))
      else
        return null
    },
    (stat, value) => genKeyValuePair(stat, value))

  pairs.forEach(pair => object[pair.key] = pair.value)
  return object
}

const enumerateNetworkInterfacesAsync = async () => {

  let names = await enumerateNetworkInterfaceNamesAsync(classNetPath)
  return await mapAsyncMapFilter(names,
    name => Promise.resolve(objectifyAsync(path.join(classNetPath, name))),
    (name, obj) => Object.assign(obj, { name }))
}

//// temporary test code
// enumerateNetworkInterfacesAsync()
//   .then(r => console.log(JSON.stringify(r, null, '  ')))
//   .catch(e => console.log(e))

export default async () => {
  let nets = await enumerateNetworkInterfacesAsync()
  return { nets, os: os.networkInterfaces() }
}


