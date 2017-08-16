const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const getFruit = require('../fruitmix')

router.get('/', auth.jwt(), (req, res) => {
  let tasks = getFruit().getTasks(req.user)
  res.status(200).json(tasks)
})

router.get('/:taskUUID', (req, res) => {
})

router.post('/', auth.jwt(), (req, res, next) => {
  getFruit().createTask(req.user, req.body, (err, task) => 
    err ? next(err) : res.status(200).json(task))
})

module.exports = router

