import { Router } from 'express'
import { localUsers } from '../model'
import config from '../config'

let router = Router()

// get user friends
router.get('/', (req, res) => {
  let useruuid = req.user.uuid;
  config.ipc.call('getUserFriends',useruuid, (err, friends) => {
    err ? res.status(500).json({})
      : res.status(200).json(Object.assign({}, { friends }))
  })
})


//req.body 
// {
//       type, username, password, nologin, isFirstUser,
//       isAdmin, email, avatar, unixname
// }

// create user
router.post('/', (req, res) => {

  // permission user uuid
  let useruuid = req.user.uuid

  let props = Object.assign({}, req.body)

  if (props.type === 'local'){
    // create local user
    config.ipc.call('createLocalUser', { useruuid, props }, (err, user) => {
      err ? res.status(500).json(err)
        : res.status(200).json(user)
    })
  } else if (props.type === 'remote'){
    // create remote user
    config.ipc.call('createRemoteUser', { useruuid, props }, (err, user) => {
      err ? res.status(500).json(err)
        : res.status(200).json(user)
    })
  } else {
    res.status(400).json({ message: 'invalid user type, must be local or remote' })
  }
})

// update user information or password
router.patch('/:userUUID', (req, res) => {

  // permission user uuid
  let useruuid = req.user.uuid
  let props = Object.assign({}, req.body, {
    uuid: req.params.userUUID
  })

  if (!props.uuid)
    return res.status(400).json('uuid is missing')

  if (props.password){
    // update password
    config.ipc.call('updatePassword', { useruuid, props }, (err, aaa) => {
      err ? res.status(500).json(err)
        : res.status(200).json({ message: 'change password sucessfully' })
    })
  } else {
    // update user without password
    config.ipc.call('updateUser', { useruuid, props }, (err, user) => {
      err ? res.status(500).json(err)
        : res.status(200).json(user)
    })
  }
})

// determine whether local users
router.get('/isLocalUser', (req, res) => {
  let user = req.user
  config.ipc.call('isLocalUser', user.uuid, (err, isLocal) => {
    err ? res.status(500).json({})
      : res.status(200).json(Object.assign({}, { isLocal }))
  })
})

export default router
