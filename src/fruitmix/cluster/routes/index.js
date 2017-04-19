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

const media = require('./media')
const ipctest = require('./ipctest')
import auth from'../middleware/auth'

let router = Router()

router.use('/init', init)
router.use('/login', login)
router.use('/token', token)
//FIXME: auth
router.use('/*', auth.jwt())
router.use('/files', files)
router.use('/filemap', filemap)
// router.use('/libraries', libraries)
router.use('/ipctest', ipctest)
router.use('/fileshare', fileshare)
router.use('/mediashare', mediashare)
router.use('media', media)

export default router
