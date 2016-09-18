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

export default router

