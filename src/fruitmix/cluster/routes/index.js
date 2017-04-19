/**
 * Created by jianjin.wu on 2017/3/22.
 * the entrance of routes
 */
import { Router } from 'express'
import init from './init'
import login from './login'
import token from './token'
import files from './files'
import filemap from './filemap'
import fileshare from './fileshare'
import mediashare from './mediashare'
import libraries from './libraries'
import admin from './admin'
import account from './account'
import drives from './drives'
import users from './users'

const media = require('./media')
const ipctest = require('./ipctest')
import auth from'../middleware/auth'

let router = Router()

router.use('/init', init)
router.use('/login', login)
router.use('/token', token)
router.use('/files', auth.jwt(), files)
router.use('/filemap', auth.jwt(), filemap)
router.use('/libraries', auth.jwt(), libraries)
router.use('/ipctest', auth.jwt(), ipctest)
router.use('/fileshare', auth.jwt(), fileshare)
router.use('/mediashare', auth.jwt(), mediashare)
router.use('/media', auth.jwt(), media)
router.use('/account', auth.jwt(), account)
router.use('/users', auth.jwt(), users)
router.use('/drives', auth.jwt(), drives)
router.use('/admin', auth.jwt(), admin)

export default router
