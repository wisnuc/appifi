import { Router } from 'express'
import auth from '../middleware/auth'

import Models from '../models/models'

const router = Router()

router.get('/sharedWithMe', auth.jwt(), (req, res) => {

  let forest = Models.getModel('forest')    

  let user = req.user

  let shared = forest.getSharedWithMe(user.uuid) 
  res.status(200).json(shared)
})

router.get('/sharedWithOthers', auth.jwt(), (req, res) => {

  let forest = Models.getModel('forest')
  let user = req.user

  let shared = forest.getSharedWithOthers(user.uuid)
  res.status(200).json(shared)
})

export default router

