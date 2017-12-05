const child = require('child_process')

const Router = require('express').Router
const debug = require('debug')('webtorrent')
const createIpcMain = require('./ipcMain')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')

const out = fs.openSync('./out.log', 'a');
const err = fs.openSync('./out.log', 'a');
let opts = { stdio: ['ignore', out, err] }

let worker = child.fork(path.join(__dirname, 'webtorrent.js'))
worker.on('error', err => console.log(err))
worker.on('exit', (code, signal) => console.log('worker exit:', code, signal))

// require('./webtorrent')

let ipc = createIpcMain(worker)

let router = Router()

// query type(optional) : enum [ finished, running ]
router.get('/', (req, res) => {
  let { torrentId, type } = req.query
  ipc.call('getSummary', { torrentId, type }, (error, data) => {
    if (error) res.status(400).json(error)
    else res.status(200).json(data)
  })
  return
  if(!req.query || !req.query.type || [ 'finished', 'running' ].indexOf(req.query.type) === -1 )
    ipc.call('getAllTask', {}, (error, data) => {
      return res.status(200).json(data)
    })
  else{
    let ipcName = req.query.type == 'finished' ? 'getFinished' : 'getSummary'
    ipc.call(ipcName, { torrentId: req.query.torrentId }, (error, data) => {
      if (error) res.status(400).json(error)
      else res.status(200).json(data)
    })
  }
})

// create new download task
router.post('/', (req, res) => {
  ipc.call('addMagnet', { magnetURL: req.body.magnetURL, downloadPath: req.body.downloadPath }, (error, data) => {
    if(error) return res.status(400).json(error)
    res.status(200).json(data)
  })
})

router.post('/torrent', (req, res) => {
  let form = new formidable.IncomingForm()
  form.uploadDir = path.join(process.cwd(), 'tmptest')
  form.keepExtensions = true
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json(err)
    let downloadPath = fields.downloadPath
    let torrentPath = files.torrent.path
    if (!downloadPath || !torrentPath) return res.status(400).end('parameter error')
    ipc.call('addTorrent', {torrentPath, downloadPath}, (err, data) => {
      if (err) return res.status(400).json(err)
      return res.status(200).json(data)
    })
  })
})

router.patch('/:torrentId', (req, res) => {
  let ops = ['pause', 'resume', 'destory']
  let op = req.body.op
  console.log(req.params.torrentId , '...')
  if(!ops.includes(op)) return res.status(400).json({ message: 'unknown op' })
  ipc.call(op, { torrentId: req.params.torrentId }, (error, data) => {
    if(error) return res.status(400).json(error)
    return res.status(200).json(data)
  })
})

module.exports = router