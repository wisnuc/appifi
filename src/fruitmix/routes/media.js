import { Router } from 'express'

import auth from '../middleware/auth'
import models from '../models/models'

const router = Router()

// return meta data of all I can view
router.get('/', auth.jwt(), (req, res) => {
  
  const forest = models.getModel('forest')
  const user = req.user

  let media = forest.getMedia(user.uuid)
  res.status(200).json(media)
})

router.get('/:digest/download', auth.jwt(), (req, res) => {

  const forest = models.getModel('forest')
  const user = req.user
  const digest = req.params.digest

  let filepath = forest.readMedia(user.uuid, digest) 

  if (!filepath) 
    return res.status(404).json({}) 

  res.status(200).sendFile(filepath)
})

/**
  use query string, possible options:

  width: 'integer',
  height: 'integer'
  modifier: 'caret',      // optional
  autoOrient: 'true',     // optional
  instant: 'true'         // optional

  width and height, provide at least one
  modifier effectvie only if both width and height provided
**/
  
router.get('/:digest/thumbnail', (req, res) => {

  const user = req.user
  const digest = req.params.digest
  const query = req.query

  const thumbnailer = models.getModel('thumbnailer')
  thumbnailer.request(digest, query, (err, ret) => {

    console.log('>>>>')
    console.log(err || ret)
    console.log('<<<<')

    if (err) return res.status(500).json(err)

    if (typeof ret === 'object') {
      res.status(202).json(ret)
    }
    else {
      res.status(200).sendFile(ret)
    }
  })
})

export default router
