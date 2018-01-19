const router = require('express').Router()
const jwt = require('jwt-simple')
const secret = require('../config/passportJwt')
const auth = require('../middleware/auth')
const getFruit = require('../fruitmix')

const userInfo = (req, res, next) => {
  let guid = req.query.guid
  let text = req.get('Authorization')
  if (text) {
    let split = text.split(' ')
    let local = jwt.decode(split[1], secret)
    let user = getFruit().findUserByUUID(local.uuid)

    if (!user || user.global.id !== guid)
      return res.status(401).end()
    req.user = { global: {id: user.global.id} }
    next()
  } else {
    let exist = [...getFruit().boxData.boxes.values()].find(box => (box.doc.users.includes(guid)
                    || box.doc.owner === guid))
    if (!exist) return res.status(401).end()
    req.user = { global: {id: guid} }
    next()
  }
}

router.get('/', userInfo, (req, res) => {
  let user = req.user
  if (user.global) {
    let token = {
      global: user.global,
      deadline: new Date().getTime() + 4 * 60 * 60 * 1000
    }
    res.status(200).json({ type: 'JWT', token: jwt.encode(token, secret) })
  } else {
    res.status(404).end()
  }
})

// { token: xxxxx }
router.post('/decode', (req, res) => {
  let decoded = jwt.decode(req.body.token, secret)
  res.status(200).json(decoded)
})

module.exports = router
