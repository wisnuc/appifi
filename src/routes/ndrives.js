const path = require('path')
const fs = require('fs')

const router = require('express').Router() 

const getFruit = require('../fruitmix')

const fruit = (req, res, next) => {
  req.fruit = getFruit()
  if (req.fruit) {
    next()
  } else {
    res.status(503).json({ message: 'fruitmix not available' })
  }
}

/**
NativeDriveList GET
*/
router.get('/', fruit, /** auth.jwt(), **/ (req, res, next) => 
  req.fruit.getNativeDrives(req.user, (err, ndrives) => 
    err ? next(err) : res.status(200).json(ndrives)))

/**
NativeDriveEntry GET
*/
router.get('/:id/entries', fruit, /** auth.jwt(), **/ (req, res, next) => 
  req.fruit.getNativeDriveEntry(req.user, req.params.id, '', (err, union) =>  err 
    ? next(err)
    : Array.isArray(union)
      ? res.status(200).json(union)
      : res.status(200).sendFile(union)))
 
router.get('/:id/entries/*', fruit, /** auth.jwt(), **/ (req, res, next) => 
  req.fruit.getNativeDriveEntry(req.user, req.params.id, req.params[0], (err, union) =>  err 
    ? next(err)
    : Array.isArray(union)
      ? res.status(200).json(union)
      : res.status(200).sendFile(union)))
    

module.exports = router

