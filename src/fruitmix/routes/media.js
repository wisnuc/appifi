import { Router } from 'express'

import auth from '../middleware/auth'
import Models from '../models/models'

const router = Router()

// return meta data of all I can view
router.get('/', auth.jwt(), (req, res) => {
  
  const forest = Models.getModel('forest')
  const user = req.user

  let media = forest.getMedia(user.uuid)
  res.status(200).json(media)

})

router.get('/:digest/download', auth.jwt(), (req, res) => {

  const forest = Models.getModel('forest')
  const user = req.user
  const digest = req.params.digest

  let filepath = forest.readMedia(user.uuid, digest) 

  if (!filepath) 
    return res.status(404).json({}) 

  res.status(200).sendFile(filepath)
})

export default router
