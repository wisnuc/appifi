import path from 'path'
import fs from 'fs'
import { Router } from 'express'

import auth from '../middleware/auth'
import paths from '../lib/paths'
import models from '../models/models'
import scan from '../lib/winsun'

const router = Router()

router.get('/', (req, res) => {

  let fruit = paths.get('root')
  let vroot = path.resolve(fruit, '../..') 
  scan(vroot, (err, nodes) => {
    if (err) return res.status(500).end()
    res.status(200).json(nodes)
  })
})

router.post('/', a(req, res) => {

  let repo = models.getModel('repo')
  let user = req.user

  /**
  {
    src: 'a name, or nobody/name',
    dst: a drive uuid
  }
  **/  

  

})

export default router
