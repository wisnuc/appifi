
import { Router } from 'express'
import config from '../config'

let router = Router();

// get all local user info
router.get('/users', (req, res) => {

	// permission useruuid
	let useruuid = req.user.uuid;
	config.ipc.call('getAllLocalUser', useruuid, (err, users) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { users }))
	})
})

// admin create user
router.post('/users', (req, res) => {

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

// admin update user
router.patch('/users/:userUUID', (req, res) => {

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

// get all public drive
router.get('/drives', (req, res) => {
	let useruuid = req.user.uuid
	config.ipc.call('getAllPublicDrive', useruuid, (err, drives) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drives }))
	})
})

// add pulbic drive
router.post('/drives', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.body;
	config.ipc.call('createPublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

// update public drive
router.patch('/:driveUUID', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.drive;
	config.ipc.call('updatePublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

export default router
