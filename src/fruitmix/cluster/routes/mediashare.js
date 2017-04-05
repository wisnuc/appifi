import { Router } from 'express'
import auth from '../middleware/auth'
import config from '../config'

let router = Router()

// get all mediaShares of a user
router.get('/', auth.jwt(), (req, res) => {
  let user = req.user

  config.ipc.call('getUserMediaShares', { userUUID: user.uuid }, (err, shares) => {
    if(err) return res.error(err, 400)
    res.success(shares)
  })
})

// create a mediaShare
router.post('/', auth.jwt(), (req, res) => {
  let user = req.user
  let props = Object.assign({}, req.body)

  config.ipc.call('createMediaShare', { userUUID: user.uuid, props }, (err, share) => {
    if(err) return res.error(err, 500)
    res.success(share)
  })
})

// update a mediaShare
router.patch('/:shareUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let shareUUID = req.params.shareUUID
  let props = Object.assign({}, req.body)

  config.ipc.call('updateMediaShare', { userUUID: user.uuid, shareUUID, props }, (err, newShare) => {
    if(err) return res.error(err, 500)
    res.success(newShare)
  })
})

// delete a mediaShare 
router.delete('/:shareUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let shareUUID = req.params.shareUUID

  config.ipc.call('deleteMediaShare', { userUUID: user.uuid, shareUUID }, (err, data) => {
    if(err) return res.error(err, 500)
    res.success()
  })
})

export default router


