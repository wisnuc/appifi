const child = require('child_process')

const Router = require('express').Router
const debug = require('debug')('webtorrent')
const createIpcMain = require('./ipcMain')
const fs = require('fs')
const path = require('path')

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
  if(!req.query || !req.query.type || [ 'finished', 'running' ].findIndex(req.query.type) === -1 )
    ipc.call('getAllTask', {}, (error, data) => {
      return res.status(200).json(data)
    })
  else{
    let ipcName = req.query.type == 'finished' ? 'getFinished' : 'getSummary'
    ipc.call(ipcName, {}, (error, data) => {
      return res.status(200).json(data)
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

router.patch('/:torrentId', (req, res) => {
  let ops = ['pause', 'resume', 'destory']
  let op = req.body.op
  if(!ops.includes(op)) return res.status(400).json({ message: 'unknown op' })
  ipc.call(op, { torrentId: req.params.torrentId }, (error, data) => {
    if(error) return res.status(400).json(error)
    return res.status(200).json(data)
  })
})

module.exports = router