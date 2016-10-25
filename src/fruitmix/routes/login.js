import { Router } from 'express'
import Models from '../models/models'

const router = Router()

router.get('/', (req, res) => {

  let User = Models.getModel('user')
  let mapped = User.collection.list
                .map(usr => ({
                  uuid: usr.uuid,
                  username: usr.username,
                  avatar: usr.avatar,
                  unixUID: usr.unixUID
                }))

  res.nolog = true
  res.status(200).json(mapped)
})

export default router

