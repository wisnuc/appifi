import path from 'path'
import { mkdirpAsync, fs } from '../util/async'

import Promise from 'bluebird'

// holds fruitmix root path, something like /run/wisnuc/[UUID]/wisnuc/fruitmix
// either absolute path or undefined
let root = undefined

// util functoin
const join = (name) => path.join(root, name)

// set fruitmix root, mkdirp all internal folders
const setRootAsync = async (rootpath) => {

  if (!path.isAbsolute(rootpath)) 
    throw new Error('rootpath must be absolute path')     

  root = rootpath
  await mkdirpAsync(root)
  await Promise.all([
    mkdirpAsync(join('models')),
    mkdirpAsync(join('drives')),
    mkdirpAsync(join('documents')),
    mkdirpAsync(join('mediashare')),
    mkdirpAsync(join('mediashareArchive')),
    mkdirpAsync(join('mediatalk')),
    mkdirpAsync(join('mediatallArchive')),
    mkdirpAsync(join('thumbnail')),
    mkdirpAsync(join('log')),
    mkdirpAsync(join('etc')),
    mkdirpAsync(join('tmp'))
  ])
}

// callback version of setRoot
const setRoot = (rootpath, callback) => 
  setSysRootAsync(rootpath)
    .then(r => callback(null, r))
    .catch(e => callback(e))

// discard root
const unsetRoot = () => root = undefined

// get path by name, throw if root unset or name unknown
const getPath = (name) => {

  if (!root) throw new Error('fruitmix root not set')

  switch(name) {
  case 'models':
  case 'drives':
  case 'documents':
  case 'mediashare':
  case 'mediashareArchive':
  case 'mediatalk':
  case 'mediatalkArchive':
  case 'thumbnail':
  case 'log':
  case 'etc':
  case 'tmp':
    return join(name)
  case 'root':
    return root
  default:
    throw new Error(`unknown fruitmix path name: ${name}`)
  }
}

export default { 
  setRoot,
  setRootAsync,
  unsetRoot,
  get: getPath
}

