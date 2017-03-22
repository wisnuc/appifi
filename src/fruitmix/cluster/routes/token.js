import { Router } from 'express'
import jwt from 'jwt-simple'

import { localUsers } from '../model'
import { secret } from '../../config/passportJwt'
import auth from '../middleware/auth'

let router = Router()

router.get('/', auth.basic(), (req, res) => {
  res.status(200).json({
    type: 'JWT',
    token: jwt.encode({ uuid: req.user.uuid }, secret)
  })  
})

export default router