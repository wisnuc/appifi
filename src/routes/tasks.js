const router = require('express').Router()

const auth = require('../middleware/auth')
const getFruit = require('../fruitmix')

// List all tasks
router.get('/', auth.jwt(), (req, res) => 
  getFruit().getTasks(req.user, (err, tasks) => 
    res.status(200).json(tasks)))

// Create a New Task
router.post('/', auth.jwt(), (req, res, next) =>
  getFruit().createTask(req.user, req.body, (err, task) => 
    err ? next(err) : res.status(200).json(task)))

// Get single task
router.get('/:taskUUID', auth.jwt(), (req, res) => 
  getFruit().getTask(req.user, req.params.taskUUID, (err, task) => 
    err ? next(err) : res.status(200).json(task)))

// Delete single task (Can be used as abort)
router.delete('/:taskUUID', auth.jwt(), (req, res) => 
  getFruit().deleteTask(req.user, req.params.taskUUID, (err, task) =>
    err ? next(err) : res.status(200).end()))

// Update single sub-task
router.patch('/:taskUUID/nodes/:nodeUUID', auth.jwt(), (req, res, next) => 
  getFruit().updateSubTask(req.user, req.params.taskUUID, req.params.nodeUUID, req.body, (err, data) => 
    err ? next(err) : res.status(200).json(data)))

// Delete single sub-task
router.delete('/:taskUUID/nodes/:nodeUUID', auth.jwt(), (req, res) =>
  getFruit().deleteSubTask(req.user, req.params.taskUUID, req.params.nodeUUID, (err, data) => 
    err ? next(err) : res.status(200).end()))

module.exports = router
 
