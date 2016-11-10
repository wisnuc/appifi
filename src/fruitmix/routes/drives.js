import path from 'path'
import fs from 'fs'
import Debug from 'debug'
import { Router } from 'express'
import { storeState } from '../../reducers'
import auth from '../middleware/auth'
import Models from '../models/models'

const debug = Debug('fruitmix:routes:drives')
const router = Router()

/**

Drive {
 domain: null,
 _events: [Object],
 _eventsCount: 1,
 _maxListeners: undefined,
 proto: [Object],
 uuidMap: [Object],
 hashMap: [Object],
 hashless: [Object],
 shares: [Object],
 root: [Object],
 uuid: '6586789e-4a2c-4159-b3da-903ae7f10c2a',
 owner: [Object],
 writelist: [],
 readlist: [],
 fixedOwner: true,
 cacheState: 'CREATED',
 rootpath: '/home/wisnuc/fruitmix/tmptest/drives/6586789e-4a2c-4159-b3da-903ae7f10c2a' } ],

**/

// router.get('/', auth.jwt(), (req, res) => {
router.get('/', (req, res) => {

  let blocks = storeState().storage.blocks
  console.log(blocks.filter(blk => blk.stats.isMounted))

  let repo = Models.getModel('repo')
  return res.status(200).json(repo.getDrives())
}) 



// for filesystem
// type === filesystem
// name === block name such as sda
// path === relative path to sda mountpoint
// 
// filesystem must be mounted
// filesystem must not be roofs
// if the filesystem containing current wisnuc instance, path must not be starting with /wsinc
//   if path is '/', then result should filter out wisnuc folder
router.get('/list', (req, res) => {

  debug('list, req.query', req.query)

  const { type, name } = req.query 
  let qpath = req.query.path

  if (type === 'filesystem') {

    if (typeof name !== 'string' || typeof qpath !== 'string')
      return res.status(400).json({ message: `name and path must be string` })

    let blocks = storeState().storage.blocks
    let block = blocks.find(blk => blk.name === name)

    if (!block) 
      return res.status(404).json({ message: `block ${name} not found` })

    if (!block.stats.isFileSystem)
      return res.status(400).json({ message: `block is not a filesystem` })

    debug('list, block', block)
    if (!block.stats.isMounted)
      return res.status(400).json({ message: `block ${name} not mounted` })

    debug('list, block.stats.mountpoint', block.stats.mountpoint)
    if (block.stats.mountpoint === '/')
      return res.status(400).json({ message: `block ${name} is rootfs` })

    let mp = block.stats.mountpoint

    // end mp with a single '/'
    mp = mp.endsWith('/') ? mp : mp + '/'
    // no leading '/' for qpath
    while (qpath.startsWith('/')) qpath = qpath.slice(1)
 
    let abspath = path.join(mp, qpath)

    debug('list, mp and abspath', mp, abspath)

    if (!abspath.startsWith(mp)) // invalid path
      return res.status(400).json({ message: `invalid path ${query.path}` })

    fs.readdir(abspath, (err, entries) => {
      if (err) 
        return res.status(500).json({ code: err.code, message: err.message })

      if (entries.length === 0)
        return res.status(200).json([])

      let count = entries.length
      let list = []
      entries.forEach(entry => {
        fs.lstat(path.join(abspath, entry), (err, stat) => {
          if (!err) {
            if (stat.isDirectory() || stat.isFile()) {
              list.push({
                name: entry,
                type: stat.isDirectory() ? 'folder' : 'file',
                size: stat.size,
                mtime: stat.mtime
              }) 
            }
          }
          if (!--count) {
            res.status(200).json(list)
          }
        })
      })
    })
  }
  else if (type === 'appifi') {
  }
  else
    return res.status(400).json({
      message: 'unrecognized type'
    })
})

export default router
