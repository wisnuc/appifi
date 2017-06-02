const router = require('express').Router()
const auth = require('../middleware/auth')

const Drive = require('../drive/drive')

router.get('/', auth.jwt(), (req, res) => {

  let drives = Drive.drives.filter(drv => {
    if (drv.type === 'private' && drv.owner === req.user.uuid)
      return true
    if (drv.type === 'public') {
      if (drv.writelist.includes(req.user.uuid) ||
        drv.readlist.includes(req.user.uuid))
      return true
    }
    return false
  })

  res.status(200).json(drives)
})

module.exports = router

