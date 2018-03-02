const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const stream = require('stream')
const crypto = require('crypto')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const router = require('express').Router()
const auth = require('../middleware/auth')
const sanitize = require('sanitize-filename')
const UUID = require('uuid')
const { isSHA256, isUUID } = require('../lib/assertion')
const getFruit = require('../fruitmix')
const Debug = require('debug')
const debug = Debug('Tags')

router.get('/', auth.jwt(), (req, res, next) => {

})