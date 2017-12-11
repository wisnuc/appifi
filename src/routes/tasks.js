const router = require('express').Router()

const auth = require('../middleware/auth')
const getFruit = require('../fruitmix')

/**
SubTask operation use wildcard url, which is supported by express as regex.

The regex matched url component is accessed via req.params[0].

On client-side, `encodeURIComponent` is used to encode the path string, 
when a path string, instead of a uuid, is used as resource identifier.

On server-side, express automatically decode the encoded uri component.
*/

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
router.patch('/:taskUUID/nodes/*', auth.jwt(), (req, res, next) => 
  getFruit().updateSubTask(req.user, req.params.taskUUID, req.params[0], req.body, (err, data) => 
    err ? next(err) : res.status(200).json(data)))

// Delete single sub-task
router.delete('/:taskUUID/nodes/*', auth.jwt(), (req, res) =>
  getFruit().deleteSubTask(req.user, req.params.taskUUID, req.params[0], (err, data) => 
    err ? next(err) : res.status(200).end()))

module.exports = router

