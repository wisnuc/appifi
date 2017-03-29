/**
 * Created by jianjin.wu on 2017/3/28.
 * the entrance of file routes
 */

import { Router } from 'express'
// import fruitmix from './fruitmix'

const external = require('./external')
const transfer = require('./transfer')

let router = Router()

// router.use('/fruitmix', fruitmix)
router.use('/external', external)
router.use('/transfer', transfer)

export default router
