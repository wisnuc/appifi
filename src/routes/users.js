const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')
const UUID = require('uuid')
const getFruit = require('../fruitmix')

const EUnavail = Object.assign(new Error('fruitmix unavailable'), { status: 503 })
const fruitless = (req, res, next) => getFruit() ? next() : next(EUnavail)

router.get('/', 
  fruitless, 

  // for display users 
  (req, res, next) => {
    let fruit = getFruit()
    if (req.get('Authorization')) return next()   
    res.status(200).json(fruit.displayUsers())
  }, 
  auth.jwt(), 
  // for authorized users
  (req, res) => {
    let fruit = getFruit()
    // TODO
  })


router.post('/', 
  fruitless, 
  (req, res, next) => {
    let fruit = getFruit()
    if (fruit.hasUsers()) return next()
    fruit.createUserAsync(req.body) 
      .then(user => res.status(200).json(user))
      .catch(next)
  }, 
  auth.jwt(), 
  (req, res, next) => {
    let fruit = getFruit()
    fruit.createUserAsync(req.body) 
      .then(user => res.status(200).json(user))
      .catch(next)
  })

router.get('/:uuid', auth.jwt(), (req, res) => {
  
  let uuid = req.params.uuid
  let user = req.user

  if (user.uuid === uuid) return res.status(200).json(user)

  if (user.isAdmin) {
    let u = User.findUser(uuid) 
    if (u) 
      res.status(200).json(u)
    else
      res.status(404).end()

    return
  }

  res.status(403).end() // TODO message? 
})

router.patch('/:userUUID', fruitless, auth.jwt(), (req, res, next) => {
  let fruit = getFruit()
  let { userUUID } = req.params
  fruit.updateUserAsync(req.user, userUUID, req.body)
    .then(user => res.status(200).json(user))
    .catch(next)
})

router.post('/:uuid/password', auth.jwt(), (req, res) => {

})

/**
router.get('/', auth.jwt(), (req, res) => {

  const user = req.user
  const userList = Models.getModel('user').collection.list

  if (user.isAdmin) {
    let list = Models.getModel('user').collection.list
    return res.status(200).json(list.map(u => Object.assign({}, u, {
      password: undefined,
      smbPassword: undefined,
      lastChangeTime: undefined
    })))
  }
  else {
    return res.status(200).json([Object.assign({}, user, {
      password: undefined,
      smbPassword: undefined,
      lastChangeTime: undefined
    })])
  }
})


router.post('/', auth.jwt(), (req, res) => {

  const user = req.user 
  const userModel = Models.getModel('user')

  if (!user.isAdmin) {
    return res.status(401).json({})
  }

  let props = Object.assign({}, req.body, {
    type: 'local'
  })

  // create user
  userModel.createUser(props, (err, newUser) => {

    if (err) return res.status(500).json({
      code: err.code,
      message: err.message
    })

    const repo = Models.getModel('repo')    
    repo.createUserDrives(newUser, () => {
      res.status(200).json(Object.assign({}, newUser, {
        password: undefined,
        smbPassword: undefined, 
        lastChangeTime: undefined
      }))
    })
  })

})

router.patch('/:userUUID', auth.jwt(), (req, res) => {

  const user = req.user
  const userModel = Models.getModel('user')
  const userUUID = req.params.userUUID

  if (!user.isAdmin && userUUID !== user.uuid) {
    return res.status(401).json({})
  }

  let props = Object.assign({}, req.body)

  userModel.updateUser(userUUID, props, (err, user) => {

    if (err) return res.status(500).json({
      code: err.code,
      message: err.message
    })

    return res.status(200).json(Object.assign({}, user, {
      password: undefined,
      smbPassword: undefined,
      lastChangeTime: undefined
    }))
  })
})

/**
router.post('/',auth.jwt(), (req, res) => {
  if (req.user.isAdmin === true ) {
    var tmpuuid=uuid.v4()
    var newuser = new User({
      uuid: tmpuuid,
      username: req.body.username,
      password: req.body.password,
      avatar: 'defaultAvatar.jpg',
      isAdmin: req.body.isAdmin,
      email:req.body.email,
      isFirstUser: false,
      type: 'user',
    })
    newuser.save((err) => {
      if (err) { return res.status(500).json(err) }
      spawnSync('mkdir',['-p','/data/fruitmix/drive/'+tmpuuid])
      let fm={}
      fm.owner=tmpuuid
      xattr.setSync('/data/fruitmix/drive/'+tmpuuid,'user.fruitmix',fm)
      xattr.setSync('/data/fruitmix/drive/'+tmpuuid,'user.owner',tmpuuid)
      builder.checkall('/data/fruitmix/drive/'+tmpuuid)
      return res.status(200).json(newuser)
    })
  }
  else{
    return res.status(403).json('403 Permission denied')
  }
})
**/
/*
router.delete('/',auth.jwt(), (req, res) => {
  if (req.user.isAdmin === true ) {
    if(!req.body.uuid){return res.status(400).json('uuid is missing')}
    User.remove({ uuid: req.body.uuid }, (err) => {
      if (err) { return res.status(500).json(null) }
      return res.status(200).json(null)
    })
  }
  else{
    return res.status(403).json('403 Permission denied')
  }})

router.patch('/',auth.jwt(), (req, res) => {
  if (req.user.isAdmin === true ) {
    if(!req.body.uuid){return res.status(400).json('uuid is missing')}
    User.update({uuid:req.body.uuid},{$set:{username:req.body.username,isAdmin:req.body.isAdmin,password:req.body.password}},(err) => {
      if (err) { return res.status(500).json(null) }
      return res.status(200).json(null)
    })}
  else{
    return res.status(403).json('403 Permission denied')
  }
})

module.exports = router
*/

/*
import { Router } from 'express'
import Models from '../models/models'

const router = Router()


router.get('/', (req, res) => {
  //console.log(UserModel.data.collection.list);
  let r = UserModel.data.collection.list.reduce((pre, cur) => pre.concat([{'uuid':cur.uuid, 'avatar':cur.avatar==null?'':cur.avatar, 'email':cur.email, 'username':cur.username}]), [])
  //res.status(200).end()
  res.status(200).json(r)
})

router.post('/', (req, res) => {

  UserModel.data.createUser(req.body) 
    .then(() => { res.status(200).end()})
    .catch(e => { res.status(e.code === 'EINVAL' ? 400 : 500).json({
      code: e.code,
      message: e.message
    })})
  })

router.delete('/', (req, res) => {
  //console.log('MMM '+req.body.uuid);
  UserModel.data.deleteUser(req.body.uuid) 
  .then(() => { 
    //console.log(UserModel.data.collection.list);
    res.status(200).end()
  })
})

*/

module.exports = router

