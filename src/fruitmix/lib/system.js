import fs from 'fs'
import path from 'path'

import Promise from 'bluebird'
import paths from './paths'
import models from '../models/models'
import { createUserModelAsync } from '../models/userModel'
import { createDriveModelAsync } from '../models/driveModel'
import { createDrive } from './drive'
import { createRepo } from './repo'
import createUUIDLog from './uuidlog'
import { createDocumentStore } from './documentStore'
import { createMediaShareStore } from './mediaShareStore'
import createMedia from './media'

let initialized = false

const avail = (req, res, next) => initialized ? next() : res.status(503).end()  

const initAsync = async (sysroot) => {

  // set sysroot to paths
  await paths.setRootAsync(sysroot)
  console.log(`sysroot is set to ${sysroot}`)

  let modelPath = paths.get('models')
  let tmpPath = paths.get('tmp')

  // create and set user model
  let userModelPath = path.join(modelPath, 'users.json')
  let userModel = await createUserModelAsync(userModelPath, tmpPath)
  models.setModel('user', userModel)

  let driveModelPath = path.join(modelPath, 'drives.json')
  let driveModel = await createDriveModelAsync(driveModelPath, tmpPath)
  models.setModel('drive', driveModel)

  let logpath = paths.get('log')
  let log = createUUIDLog(logpath)
  models.setModel('log', log)

  let forest = createDrive()
  models.setModel('forest', forest)

  let repo = createRepo(paths, driveModel, forest)
  models.setModel('repo', repo)
  repo.init(err => err ? console.log(err) : null)

  let docPath = paths.get('documents')
  let docstore = await Promise.promisify(createDocumentStore)(docPath, tmpPath)

  let mediasharePath = paths.get('mediashare')  
  let mediashareArchivePath = paths.get('mediashareArchive')
  
  let msstore = createMediaShareStore(mediasharePath, mediashareArchivePath, tmpPath, docstore) 

  let media = createMedia(msstore)
  models.setModel('media', media)

  initialized = true
}

const deinit = () => {
  // there will be race conditon !!! FIXME
  models.clear()
  paths.unsetRoot()  
}

const system = {
  avail,
  init: (sysroot, callback) => 
    initAsync(sysroot)
      .then(r => callback(null))
      .catch(e => callback(e))
}

export default system

