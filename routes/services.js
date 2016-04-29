'use strict'

const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const child = require('child_process')
const async = require('async')

router.get('/volume/default', function(req, res, next) {

  let cmd = 'systemctl is-active run-wisnuc-volume-default.mount'

  child.exec(cmd, (err, stdout, stderr) => {

    let isActive = !err ? true : false

    res.status(200).json({
      name: 'default',
      isActive : isActive
    })
  })
})

router.get('/dockers/default', function(req, res, next) {

  let cmd = 'systemctl is-active docker'

})

module.exports = router

