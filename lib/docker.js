'use strict'

var dockerode = require('dockerode')

module.exports = new dockerode({ socketPath: '/var/run/docker.sock' })

