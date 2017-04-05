/**
 * Created by jianjin.wu on 2017/3/28.
 * the entrance of file routes
 */
const router = require('express').Router()

// import { Router } from 'express'
// import fruitmix from './fruitmix'

const fruitmix = require('./fruitmix')
const external = require('./external')
const transfer = require('./transfer')
const test = require('./test')

router.use('/fruitmix', fruitmix)
router.use('/external', external)
router.use('/transfer', transfer)
router.use('/test', test)

export default router
