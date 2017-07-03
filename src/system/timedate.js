const child = require('child_process')
const router = require('express').Router()

/**
`timedate` is a pure function, transforming `timedatectl` command output to clients.
This module exports a router.

@module timedate
*/
router.get('/', (req, res) => child.exec('timedatectl', (err, stdout, stderr) => {
  if (err) {
    res.status(500).json({code: err.code, message: err.message})
  }
  else {
    let timedate = stdout
      .toString()
      .split('\n')
      .filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})
    res.status(200).json(timedate)
  }
}))

module.exports = router

