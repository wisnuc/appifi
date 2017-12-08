const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const getFruit = require('../fruitmix')

const f = af => (req, res, next) => af(req, res).then(x => x, next)

router.get('/', auth.jwt(), (req, res) => {
  let tasks = getFruit().getTasks(req.user)
  res.status(200).json(tasks)
})

router.get('/:taskUUID', auth.jwt(), (req, res) => {
  let task = getFruit().getTasks(req.user).find(t => t.uuid === req.params.taskUUID)
  if (!task) {
    res.status(404).end()
  } else {
    res.status(200).json(task)
  }
})


router.patch('/:taskUUID/node', auth.jwt(), (req, res) => {
})

router.patch('/:taskUUID/nodes/:nodeUUID', auth.jwt(), (req, res, next) => {
  let { taskUUID, nodeUUID } = req.params
  getFruit().updateTask(req.user, taskUUID, nodeUUID, req.body, (err, view) => 
    err ? next(err) : res.status(200).json(view))
})

router.post('/', auth.jwt(), f(async (req, res) => 
  res.status(200).json(await getFruit().createTaskAsync2(req.user, req.body))))

/**
router.post('/', auth.jwt(), f(async (req, res) => {

}))
**/

module.exports = router

