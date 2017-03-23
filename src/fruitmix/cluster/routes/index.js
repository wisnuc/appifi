/**
 * Created by jianjin.wu on 2017/3/22.
 * the entrance of routes
 */
const router = require('express').Router()

const login = require('./login')
const files = require('./files')
const ipctest = require('./ipctest')
const auth = require('../middleware/auth')

app.use('/login', login)
//fixme auth
// app.use('/*', auth.jwt())
app.use('/files', files)
app.use('/ipctest', ipctest)

export default router