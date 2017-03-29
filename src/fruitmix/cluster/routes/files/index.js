/**
 * Created by jianjin.wu on 2017/3/28.
 * the entrance of file routes
 */
const router = require('express').Router()

const fruitmix = require('./fruitmix')
const external = require('./external')
const transfer = require('./transfer')


router.use('/fruitmix', fruitmix)
router.use('/external', external)
router.use('/transfer', transfer)

export default router
