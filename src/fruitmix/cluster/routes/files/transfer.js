const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const router = require('express').Router()
const validator = require('validator')

import config from '../../config'

const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false

router.get('/hello', (req, res) => {
  res.status(200).end()
})

router.get('/', (req, res) => {
  config.ipc.call('getWorkers', req.user.uuid, (e, workers) => {
    if(e) return res.error(e, 500)
    return res.success(workers, 200)
  })
})

/**
 * src / dst:{
 *  type: 'fruitmix' or 'ext'
 *  path:  if type = 'fruitmix', UUID / else relpath
 *  rootPath: if type = 'fruitmix' ,it undefine, else UUID
 * }
 * 
 */

router.post('/:type', (req, res) => {
  let type =  req.params.type === 'move' ? 'createMove'
                  : req.params.type === 'copy' ? 'createCopy' : undefined
  if(type){
    let src = req.body.src
    let dst = req.body.dst
    if(typeof src.path !== 'string' || typeof dst.path !== 'string')
      return res.error(new Error('path type error'), 400)
    if(!((src.type === 'fruitmix' && isUUID(src.path)) || (src.type === 'ext' && !path.isAbsolute(src.path))))
      return res.error(new Error('src error'), 400)
    if(!((dst.type === 'fruitmix' && isUUID(dst.path)) || !(dst.type === 'ext' && !path.isAbsolute(dst.path))))
      return res.error(new Error('dst error'), 400)
      
    config.ipc.call(type, { src, dst, userUUID: req.user.uuid }, (e, data) => {
      if(e){ 
        console.log(e)
        return res.error(e, 500)
      }
      return res.success(data, 200)
    })
  }else{
    res.error(null, 404)
  }
})

router.post('/abort/:taskid', (req, res) => {
  let args = { userUUID: req.user.uuid , workerId: req.params.taskid }
  config.ipc.call('abortWorker', args, (err, data) => {
    if(err) return res.error(err, 500)
    return res.success(null, 200)
  })
})

module.exports = router
