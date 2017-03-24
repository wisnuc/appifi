const router = require('express').Router()

const { localUsers } = require('../model')

router.get('/', (req, res) => {

  localUsers((err, users) => {

    if (err) {
      return res.status(500).json({
        err: {
          code: err.code,
          message: err.message
        }
      })
    }

    res.status(200).json(users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      avatar: u.avatar,
      unixUID: u.unixuid
    })))
  })
})

module.exports = router

