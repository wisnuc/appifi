import { Router } from 'express'

import { localUsers } from '../model'
import auth from '../middleware/auth'

let router = Router()

router.get('/', auth.jwt(), (req, res) => {
  const user = req.user
  if(user.isAdmin)
    localUsers((e, users) => {
      if(e) return res.status(500).json({})
      return res.status(200).json(list.map(u => Object.assign({}, u, {
        password: undefined,
        smbPassword: undefined,
        lastChangeTime: undefined
      })))
    })
  else
    return res.status(200).json([Object.assign({}, user, {
      password: undefined,
      smbPassword: undefined,
      lastChangeTime: undefined
    })])
})

