/**
 * Created by jianjin.wu on 2017/3/28.
 * the entrance of file routes
 */

import { Router } from 'express'
import fruitmix from './fruitmix'

let router = Router()

router.use('/fruitmix', fruitmix)

export default router