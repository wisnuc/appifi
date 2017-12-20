const child = require('child_process')

const Router = require('express').Router
const debug = require('debug')('webtorrent')
const { createIpcMain, getIpcMain } = require('./ipcMain')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const mkdirp = require('mkdirp')

const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const auth = require('../middleware/auth')
/**
const out = fs.openSync('./out.log', 'a');
const err = fs.openSync('./out.log', 'a');
let opts = { stdio: ['ignore', out, err] }
**/

var worker = null
var ipc = null 

// init torrent after fruitmix started
broadcast.on('FruitmixStarted', () => {
  // create torrentTmp if it has not been created

  if (process.env.hasOwnProperty('NODE_PATH')) {
    console.log('bypass webtorrent in auto test')
    return
  }

  let torrentTmp = path.join(getFruit().fruitmixPath, 'torrentTmp')
  mkdirp.sync(torrentTmp)
  // fork child process
  worker = child.fork(path.join(__dirname, 'webtorrent.js'), [torrentTmp], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
  worker.on('error', err => console.log(err))
  worker.on('exit', (code, signal) => console.log('worker exit:', code, signal))
  worker.on('message', msg => {
    if (msg.type !== 'move') return
    let fruitmix = getFruit()
    let user = {uuid: msg.torrent.userUUID}
    let drive = fruitmix.getDrives(user).find(item => item.tag == 'home')
    let dirUUID = msg.torrent.dirUUID
    let dirPath = fruitmix.getDriveDirPath(user, drive.uuid, dirUUID)
    let torrentPath = path.join(msg.torrent.path, msg.torrent.name)
    fs.rename(torrentPath, path.join(dirPath, msg.torrent.name), err => {
      if (err) return console.log(err) //todo
      fruitmix.driveList.getDriveDir(drive.uuid, dirUUID)
      console.log('move finish')
      ipc.call('moveFinish', {userUUID: msg.torrent.userUUID, torrentId: msg.torrent.infoHash},(err,data) => {console.log(err, data, 'this is end')})
    })
  })
  // create ipc main 
  createIpcMain(worker)
  ipc = getIpcMain()
})

let router = Router()

// query type(optional) : enum [ finished, running ]
router.get('/', auth.jwt(), (req, res) => {
  let { torrentId, type } = req.query
  let user = req.user
  ipc.call('getSummary', { torrentId, type, user }, (error, data) => {
    if (error) res.status(400).json(error)
    else res.status(200).json(data)
  })
})

// create new download task
router.post('/magnet', auth.jwt(), (req, res) => {
  ipc.call('addMagnet', { magnetURL: req.body.magnetURL, dirUUID: req.body.dirUUID, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    res.status(200).json(data)
  })
})

router.post('/torrent', auth.jwt(), (req, res) => {
  let form = new formidable.IncomingForm()
  form.uploadDir = path.join(process.cwd(), 'tmptest')
  form.keepExtensions = true
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json(err)
    let dirUUID = fields.dirUUID
    let torrentPath = files.torrent.path
    let user = req.user
    if (!dirUUID || !torrentPath) return res.status(400).end('parameter error')
    ipc.call('addTorrent', {torrentPath, dirUUID, user}, (err, torrentId) => {
      if (err) return res.status(400).json(err)
      return res.status(200).json({torrentId})
    })
  })
})

router.patch('/:torrentId', auth.jwt(), (req, res) => {
  let ops = ['pause', 'resume', 'destroy']
  let op = req.body.op
  if(!ops.includes(op)) return res.status(400).json({ message: 'unknown op' })
  ipc.call(op, { torrentId: req.params.torrentId, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    return res.status(200).json(data)
  })
})

module.exports = router
