import { Router } from 'express'
import Models from '../models/models'

const router = Router()

router.post('/', (req, res) => {

  let repo = Models.getModel('repo') 
  let userModel = Models.getModel('user')

  // if user exists
  if (userModel.collection.list.length) return res.status(404).end()

  // let Repo = Models.getModel('repo')

  let props = req.body
  props.type = 'local'

  userModel.createUser(props, (err, user) => {

    if (err) return res.status(err.code === 'EINVAL' ? 400 : 500).json({
      code: err.code,
      message: err.message
    })

    repo.createUserDrives(user, err => {

      if (err) return callback(err)

      res.status(200).json(Object.assign({}, user, {
        password: undefined,
        smbPassword: undefined,
        smbLastChangeTime: undefined
      }))
    })
  })
})

export default router

