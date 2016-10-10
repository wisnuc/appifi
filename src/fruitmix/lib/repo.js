import path from 'path'
import EventEmitter from 'events'

import { fs, mkdirp, mkdirpAsync, rimrafAsync } from '../util/async'

import paths from './paths'

import { createHashMagicBuilder } from './hashMagicBuilder'
import { createMetaBuilder } from './metaBuilder'

import { createDrive } from './drive'

// repo is responsible for managing all drives
class Repo extends EventEmitter {

  // repo constructor
  constructor(driveModel, forest, hashMagicBuilder, metaBuilder) {

    super()

    this.driveModel = driveModel
    this.forest = forest
    this.hashMagicBuilder = hashMagicBuilder
    this.metaBuilder = metaBuilder

    this.state = 'IDLE' // 'INITIALIZING', 'INITIALIZED', 'DEINITIALIZING',
  }

  async initAsync() {

    if (this.state !== 'IDLE') throw new Error('invalid state')

    this.state = 'INITIALIZING'
    
    let dir = paths.get('drives')
    let list = this.driveModel.collection.list
    let props = []

    // TODO this is the easy version
    for (let i = 0; i < list.length; i++) {

      let conf = list[i]
      if (conf.URI !== 'fruitmix') 
        continue

      try {
        let stat = await fs.statAsync(path.join(dir, conf.uuid))
        if (stat.isDirectory()) {
          props.push({
            uuid: conf.uuid,
            type: 'folder',
            owner: conf.owner,
            writelist: conf.writelist,
            readlist: conf.readlist,
            name: path.join(dir, conf.uuid)
          })
        }
      }
      catch (e) {
        continue
      }
    } // loop end

    props.forEach(prop => this.forest.createRoot(prop))
    this.state = 'INITIALIZED'
    console.log('[repo] init: initialized')
  }

  // TODO there may be a small risk that a user is deleted but drive not
  init(callback) {
    this.initAsync()
      .then(() => callback())
      .catch(e => callback(e))
  }

  // TODO
  deinit() {
    this.state = 'IDLE'
  }

  // FIXME real implementation should maintain a table
  getTmpDirForDrive(drive) {
    return paths.get('tmp') 
  }

  getTmpFolderForNode(node) {
    return paths.get('tmp')
  }

  getDrives(userUUID) {
    return this.driveModel.collection.list
  }

  //  label, fixedOwner: true, URI: fruitmix, uuid, owner, writelist, readlist, cache
  createFruitmixDrive(conf, callback) {

    let dir = paths.get('drives')
    let dpath = path.join(dir, conf.uuid)

    mkdirp(dpath, err => {
      if (err) return callback(err)
      this.driveModel.createDrive(conf, err => {
        if (err) return callback(err)

        let root = this.forest.createNode(null, {
          uuid: conf.uuid,
          type: 'folder',
          owner: conf.owner,
          writelist: conf.writelist,
          readlist: conf.readlist,
          name: dpath  
        })

        this.forest.scan(root, () => console.log(`[repo] createFruitmidxDrive: scan (newly created) root finished: ${root.uuid}`))
        
        callback(null, conf)
      })
    })
  }

  createUserDrives(user, callback) {

    let home = {
      label: 'home',
      fixedOwner: true,
      URI: 'fruitmix',
      uuid: user.home,
      owner: [user.uuid],
      writelist: [],
      readlist: [],
      cache: true 
    } 

    let lib = {
      label: 'library',
      fixedOwner: 'true',
      URI: 'fruitmix',
      uuid: user.library,
      owner: [user.uuid],
      writelist: [],
      readlist: [],
      cache: true 
    } 

    // these cannot be done concurrently , RACE !!!
    this.createFruitmixDrive(home, err => {
      if (err) return callback(err)
      this.createFruitmixDrive(lib, err => {
        if (err) return callback(err)
        callback()
      })
    })
  }
}

export const createRepo = (driveModel) => {

  let forest = createDrive()
  let hashMagicBuilder = createHashMagicBuilder(forest) 
  let metaBuilder = createMetaBuilder(forest)
  
  return new Repo(driveModel, forest, hashMagicBuilder, metaBuilder)
}



