const child = require('child_process')
const express = require('express')

/**
@module routes/TimeDate
*/

/**
Creates a timedate router, which simply returns the formatted output from `timedatectl` command.

An Auth object is required for jwt authentication. All authenticated user can access this resource.

@param {Auth} auth - authentication
@returns {object} express router
*/
module.exports = auth =>
  express.Router().get('/', auth.jwt(), (req, res) =>
    child.exec('timedatectl', (err, stdout) => err
      ? res.status(500).json({ code: err.code, message: err.message })
      : res.status(200).json(stdout
        .toString()
        .split('\n')
        .filter(l => l.length)
        .reduce((prev, curr) => {
          let pair = curr.split(': ').map(str => str.trim())
          prev[pair[0]] = pair[1]
          return prev
        }, {}))))
