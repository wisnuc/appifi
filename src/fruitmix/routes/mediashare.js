import { Router } from 'express'

import auth from '../middleware/auth'
import Models from '../models/models'

const router = Router()

router.get('/', auth.jwt(), (req, res) => {

  let Media = Models.getModel('media')
  let user = req.user

  try {
    let shares = Media.getUserShares(user.uuid)     
    res.status(200).json(shares) 
  }
  catch (e) { console.log(e) }
})

router.post('/', auth.jwt(), (req, res) => {

  let Media = Models.getModel('media')
  let user = req.user

  Media.createMediaShare(user.uuid, req.body, (err, doc) => {

    if (err) return res.status(500).json({}) // TODO
    res.status(200).json(doc)
  }) 
})

router.post('/:shareUUID/update', auth.jwt(), (req, res) => {

  try {
  let Media = Models.getModel('media')
  let user = req.user
  let shareUUID = req.params.shareUUID

  Media.updateMediaShare(user.uuid, shareUUID, req.body, (err, doc) => {

    if (err) console.log(err)

    if (err) return res.status(500).json({err})
    res.status(200).json(doc)
  })

  } catch (e) {
    console.log(e)
  }
})

router.delete('/:shareUUID', auth.jwt(), (req, res) => {

  let Media = Models.getModel('media')
  let user = req.user
  let shareUUID = req.params.shareUUID

  Media.deleteMediaShare(user.uuid, shareUUID, err => {
    if (err) return res.status(500).json({err})
    return res.status(200).end()
  })
})

export default router

