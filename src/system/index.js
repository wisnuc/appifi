import child from 'child_process'
import os from 'os'

import express from 'express'
import validator from 'validator'

import sysconfig from './sysconfig'
import mir from './mir'
import { mac2dev, aliases, addAliasAsync, deleteAliasAsync } from './ipaliasing'
import eth from './eth'

const codeMap = new Map([
  ['EINVAL', 400],
  ['ENOENT', 404]
]) 

const router = express.Router()

const K = x => y => x
const respond = (res, err, obj) => err ? 
    res.status(codeMap.get(err.code) || 500)
      .json({ code: err.code, message: err.message }) :
    res.status(200)
      .json((obj === null || obj === undefined) ? { message: 'success' } : obj)

const timedate = (callback) => 
  child.exec('timedatectl', (err, stdout, stderr) => 
    err ? callback(err) : callback(null, stdout.toString().split('\n').filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})))

// timedate
router.get('/timedate', (req, res) => timedate((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj)))

// network
router.get('/net', (req, res) => eth().asCallback((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj))) 

// aliasing
router.get('/ipaliasing', (req, res) => res.status(200).json(aliases()))

router.post('/ipaliasing', (req, res) => (async () => {

  let { mac, ipv4 } = req.body
  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac) 
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)
  
  let dev = mac2dev(mac)
  if (!dev) 
    throw Object.assign(new Error('no interface found with given mac'), { code: 'ENOENT' })

  await addAliasAsync(dev, ipv4)
  return aliases().find(alias => alias.mac === mac)

})().asCallback((err, obj) => respond(res, err, obj)))

router.delete('/ipaliasing', (req, res) => (async () => {
    
  let { mac, ipv4 } = req.body

  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac)
  console.log(existing)
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)

})().asCallback((err, obj) => respond(res, err, obj)))

// fan
router.get('/fan', (req, res) => {})

router.post('/fan', (req, res) => {

  let { scale } = req.body

  
})

router.use('/mir', mir)

export default router
