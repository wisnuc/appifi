const child = require('child_process')

const Router = require('express').Router
const debug = require('debug')('webtorrent')
const createIpcMain = require('./ipcMain')
const fs = require('fs')
const path = require('path')

const out = fs.openSync('./out.log', 'a');
const err = fs.openSync('./out.log', 'a');
let opts = { stdio: [ 'ignore', out, err ] }

let worker = child.fork(path.join(__dirname, 'webtorrent.js'))
worker.on('error', err => console.log(err))
worker.on('exit', (code, signal) => console.log('worker exit:', code, signal))

// require('./webtorrent')

let ipc = createIpcMain(worker)

let router = Router()

router.get('/', (req, res) => {
//   return res.status(200).json(Station.info())
    ipc.call('getFinish', {}, (error, data) => {
        return res.status(200).json(data)
    })
})


module.exports = router