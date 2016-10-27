import path from 'path'

import { Router } from 'express'

import auth from '../middleware/auth'
import models from '../models/models'

const router = Router()

router.get('/', auth.jwt(), (req, res) => {

  let filer = models.getModel('filer')
  let user = req.user
  let meta = filer.getMeta(user.uuid)  
  res.status(200).json(meta)
})

export default router

