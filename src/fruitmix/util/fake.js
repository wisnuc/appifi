import path from 'path'
import { mkdirpAsync, rimrafAsync, fs } from './async' 
import request from 'supertest'

import paths from '../lib/paths' 
import models from '../models/models'

import { createUserModelAsync } from 'src/fruitmix/models/userModel'
import { createDriveModelAsync } from 'src/fruitmix/models/driveModel'

import { createRepo } from 'src/fruitmix/lib/repo'

export const fakePathModel = async (fakeroot, users, drives) => {

  let dir, tmpdir

  await rimrafAsync(fakeroot)
  await mkdirpAsync(fakeroot)

  await paths.setRootAsync(fakeroot)

  // fake drive dir
  dir = paths.get('drives')
  if (drives.length) 
    await Promise.all(drives.map(drv => mkdirpAsync(path.join(dir, drv.uuid))))

  // write model files
  dir = paths.get('models')
  tmpdir = paths.get('tmp')

  if (users.length) {
    await fs.writeFileAsync(path.join(dir, 'users.json'), 
      JSON.stringify(users, null, '  '))
  }

  if (drives.length) {
    await fs.writeFileAsync(path.join(dir, 'drives.json'), 
      JSON.stringify(drives, null, '  '))
  }

  // create models
  let umod = await createUserModelAsync(path.join(dir, 'users.json'), tmpdir)
  let dmod = await createDriveModelAsync(path.join(dir, 'drives.json'), tmpdir)

  // set models
  models.setModel('user', umod)
  models.setModel('drive', dmod)
}

const createRepoSilenced = (model, callback) => {

  // kidding
  const K = x => y => x
  
  let finished = false

  let probeStarted = false
  let probeStopped = false
  let hashMagicStarted = false
  let hashMagicStopped = false
  let metaStarted = false
  let metaStopped = false

  const print = () => 
    console.log(`${probeStarted} ${probeStopped}, ${hashMagicStarted} ${hashMagicStopped}, ${metaStarted}, ${metaStopped}`)

  const allDone = () => (
    probeStarted === probeStopped &&
    hashMagicStarted === hashMagicStopped &&
    metaStarted === metaStopped)

  let repo = createRepo(model) 
 
  // if no err, return repo after driveCached
  repo.filer.on('collationsStarted', () => {
    probeStarted = true
  })

  repo.filer.on('collationsStopped', () => {
    probeStopped = true

    if (finished) return
    if (allDone()) return callback(null, repo) 
  })

  repo.hashMagicBuilder.on('hashMagicBuilderStarted', () => {
    hashMagicStarted = true
  })

  repo.hashMagicBuilder.on('hashMagicBuilderStopped', () => {
    hashMagicStopped = true
    if (finished) return
    if (allDone()) return callback(null, repo)
  })

  repo.metaBuilder.on('metaBuilderStarted', () => {
    metaStarted = true
  })

  repo.metaBuilder.on('metaBuilderStopped', () => {
    metaStopped = true
    if (finished) return
    if (allDone()) return callback(null, repo)
  })

  // init & if err return err
  repo.init(err => {

    if (err) {
      finished = true
      return callback(err)
    }

    if (repo.filer.roots.length === 0) {
      callback(null, repo)
    }
  })
}

const createRepoSilencedAsync = Promise.promisify(createRepoSilenced)

export const fakeRepoSilenced = async () => {

  let dmod = models.getModel('drive')

  // create repo and wait until drives cached
  let repo = await createRepoSilencedAsync(dmod)
  models.setModel('filer', repo.filer)
  models.setModel('repo', repo)
  return repo
}

const requestToken = (app, userUUID, passwd, callback) => {

  request(app) 
    .get('/token')
    .auth(userUUID, passwd)
    .set('Accept', 'application/json')
    .end((err, res) => {
      if (err) return callback(err)
      callback(null, res.body.token)
    })
}

export const requestTokenAsync = Promise.promisify(requestToken)


