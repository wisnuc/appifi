const path = require('path')
const { Router } = require('express')
const formidable = require('formidable')
const mkdirp = require('mkdirp')
const Manager = require('./manager')
const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const auth = require('../middleware/auth')

var router = Router()

var manager = null

broadcast.on('FruitmixStarted', () => {
  // create torrentTmp if it has not been created
  let transmissionTmp = path.join(getFruit().fruitmixPath, 'transmissionTmp')
  mkdirp.sync(transmissionTmp)
  manager = new Manager(transmissionTmp)
  manager.init()
  manager.syncList()
})

// 检查初始化结果
router.use((req, res, next) => {
  if (!manager) return res.status(500).end('transmission init failed')
  else next()
})

router.use(auth.jwt())

// 获取下载任务列表
router.get('/', (req, res) => {
  res.status(200).json(manager.getList())
})

// 提交磁链任务
router.post('/magnet', (req,res) => {
  let { magnetURL, dirUUID } = req.body
  manager.createTransmissionTask('magnet', magnetURL, dirUUID, req.user.uuid).then((data) => {
    res.status(200).end()
  }).catch(err => {
    res.status(400).json(err)
  })
})

// 暂停、开始、删除
router.patch('/:id', (req, res) => { 
  let { op } = req.body
  manager.op(Number(req.params.id), req.user.uuid ,op, (err, data) => {
    if (err) res.status(400).json({error: err.message})
    else res.status(200).json(data)
  })
})

module.exports = router
