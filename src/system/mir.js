const path = require('path')
const router = require('express').Router()

import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import validator from 'validator'
import Debug from 'debug'

import { mkfsBtrfs } from './mkfs'
import { fakeReboot } from './boot'
import { adaptStorage, initFruitmix, probeFruitmix, probeAllFruitmixes } from './adapter'

const debug = Debug('system:mir')
const router = express.Router()

const nolog = res => Object.assign(res, { nolog: true })

const decorateStorageAsync = async () => {

  let mps = [] 
  let pretty = Storage.get(true)

  pretty.volumes.forEach(vol => {
    if (vol.isMounted && !vol.isMissing) mps.push({
      ref: vol,
      mp: vol.mountpoint
    })
  })

  /** no ext4 probe now
  pretty.blocks.forEach(blk => {
    if (!blk.isVolumeDevice && blk.isMounted && blk.isExt4)
      mps.push({
        ref: blk,
        mp: blk.mountpoint
      })
  })
  **/

  await Promise
    .map(mps, obj => probeFruitmixAsync(obj.mp).reflect())
    .each((inspection, index) => {
      if (inspection.isFulfilled())
        mps[index].ref.wisnuc = inspection.value() 
      else {
        mps[index].ref.wisnuc = 'ERROR'
      }
    })

  return pretty
}


// GET /storage ? raw=true or wisnuc=true
router.get('/', (req, res) => {

  // raw storage, for debug
  if (req.query.raw === 'true')
    return res.status(200).json(Storage.get(false))

  // pretty storage
  if (req.query.wisnuc === 'true') 
    return decorateStorageAsync().asCallback((err, result) => err
      ? res.status(500).json({ code: err.code, message: err.message })
      : res.status(200).json(result)

  // using nolog because some version of pc client polling this api
  // may be removed in future TODO
  else
    return nolog(res).status(200).json(adapted)

})



module.exports = router


