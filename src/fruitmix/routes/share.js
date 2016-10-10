import { Router } from 'express'
import auth from '../middleware/auth'

import Models from '../models/models'

const router = Router()

router.get('/sharedWithMe', auth.jwt(), (req, res) => {

  let filer = Models.getModel('filer')    
  let user = req.user
  let shared = filer.getSharedWithMe(user.uuid) 
  res.status(200).json(shared)
})

router.get('/sharedWithOthers', auth.jwt(), (req, res) => {

  let filer = Models.getModel('filer')
  let user = req.user
  let shared = filer.getSharedWithOthers(user.uuid)
  res.status(200).json(shared)
})

export default router

