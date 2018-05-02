const express = require('express')

module.exports = (auth, TASK, TASKNODE) => {

  const f = (req, next) => (err, data) => 
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  let router = express.Router()

  router.get('/', auth.jwt(), (req, res, next) => TASK.LIST(req.user, {}, f(res, next)))

  router.post('/', auth.jwt(), (req, res, next) => TASK.POST(req.user, req.body, f(res, next)))

  router.get('/:taskUUID', auth.jwt(), (req, res) => 
    TASK.GET(req.user,  { taskUUID: req.params.taskUUID }, f(res, next)))

  router.delete('/:taskUUID', auth.jwt(), (req, res) => 
    TASK.DELETE(req.user, { taskUUID: req.params.taskUUID }, f(res, next)))

  router.patch('/:taskUUID/nodes/:nodeUUID', auth.jwt(), (req, res, next) =>
    TASKNODE.PATCH(req.user, { taskUUID: req.params.taskUUID, nodeUUID: req.params.nodeUUID }, f(res, next)))

  router.delete('/:taskUUID/nodes/:nodeUUID', auth.jwt(), (req, res, next) => 
    TASKNODE.DELETE(req.user, { taskUUID: req.params.taskUUID, nodeUUID: req.params.nodeUUID }, f(res, next))) 

  return router
}


