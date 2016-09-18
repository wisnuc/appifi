import { Router } from 'express'
import auth from '../middleware/auth'

import Models from '../models/models'

const router = Router()

/**

Drive {
 domain: null,
 _events: [Object],
 _eventsCount: 1,
 _maxListeners: undefined,
 proto: [Object],
 uuidMap: [Object],
 hashMap: [Object],
 hashless: [Object],
 shares: [Object],
 root: [Object],
 uuid: '6586789e-4a2c-4159-b3da-903ae7f10c2a',
 owner: [Object],
 writelist: [],
 readlist: [],
 fixedOwner: true,
 cacheState: 'CREATED',
 rootpath: '/home/wisnuc/fruitmix/tmptest/drives/6586789e-4a2c-4159-b3da-903ae7f10c2a' } ],

**/

router.get('/', auth.jwt(), (req, res) => {
  
  let repo = Models.getModel('repo')
  return res.status(200).json(repo.getDrives())
}) 

export default router
