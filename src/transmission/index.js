const path = require('path')
const { Router } = require('express')
const formidable = require('formidable')
const mkdirp = require('mkdirp')
const Manager = require('./manager')
const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')

var router = Router()

var manager = null

// module.exports = router

module.exports = (auth, fruit) => {

  fruit.on('FruitmixStarted', () => {
    let transmissionTmp = path.join(fruit.fruitmixDir, 'transmissionTmp')
    let torrentTmp = path.join(transmissionTmp, 'torrents')
    mkdirp.sync(transmissionTmp)
    mkdirp.sync(torrentTmp)
    manager = new Manager(transmissionTmp)
    if (manager && manager.client) manager.startObserver()
    else console.log('manage 或者 client 不存在， 在初始化之后')
  })

  // 检查初始化结果
  router.use((req, res, next) => {
    if (!manager || !manager.client) return res.status(503).end('transmission not available')
    else next()
  })

  router.use(auth.jwt())

  // 获取下载任务列表
  router.get('/', (req, res) => {
    res.status(200).json(manager.getList(req.user.uuid))
  })

  // 提交磁链任务
  router.post('/magnet', (req,res) => {
    let { magnetURL, dirUUID } = req.body
    if (!magnetURL || !dirUUID) return res.status(400).json({message: 'parameter error'})

    manager.createTransmissionTask('magnet', magnetURL, dirUUID, req.user.uuid, (err, data) => {
      if (err) {console.log(err);res.status(400).json({ message: err.message})}
      else res.status(200).json(data)
    })
  })

  // 种子下载任务
  router.post('/torrent', (req, res) => {
    let transmissionTmp = path.join(getFruit().fruitmixPath, 'transmissionTmp', 'torrents')
    let form = new formidable.IncomingForm()
    form.uploadDir = transmissionTmp
    form.keepExtensions = true
    form.parse(req, (err, fields, files) => {
      if (err) return res.status(500).json(err)
      let dirUUID = fields.dirUUID
      let torrentPath = files.torrent.path
      if (!dirUUID || !torrentPath) return res.status(400).end('parameter error')

      manager.createTransmissionTask('torrent', torrentPath, dirUUID, req.user.uuid, (err, data) => {
        if (err) {console.log(err);res.status(400).json({ message: err.message})}
        else res.status(200).json(data)
      })
    })
  })

  // 暂停、开始、删除
  router.patch('/:id', (req, res) => { 
    let { op, uuid } = req.body
    manager.op(Number(req.params.id), uuid, req.user.uuid ,op, (err, data) => {
      if (err) res.status(400).json({error: err.message})
      else res.status(200).json(data)
    })
  })

  return router
}