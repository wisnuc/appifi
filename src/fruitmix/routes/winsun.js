import path from 'path'
import fs from 'fs'
import { Router } from 'express'

import validator from 'validator'

import auth from '../middleware/auth'
import paths from '../lib/paths'
import models from '../models/models'
import scan from '../lib/winsun'

const router = Router()

router.get('/', (req, res) => {

  let fruit = paths.get('root')
  let vroot = path.resolve(fruit, '../..') 
  scan(vroot, (err, nodes) => {
    if (err) return res.status(500).end()
    res.status(200).json(nodes)
  })
})

const renameIfExists = (list, name) => {

  if (list.indexOf(name) === -1) return name

  let i = 0
  let newname 
  do {
    i++
    newname = name + ' (' + i.toString() + ')'
  } while (list.indexOf(newname) !== -1) 

  return newname
}

router.post('/', (req, res) => {

  let fruit = paths.get('root')
  let vroot = path.resolve(fruit, '..', '..')

  let repo = models.getModel('repo')
  let filer = models.getModel('filer')
  let user = req.user

  /**
  {
    src: 'a name, or nobody/name',
    dst: a drive uuid
  }
  **/  

  const validateSrc = (src) => {

    console.log(`src is ${src}`)

    if (typeof src !== 'string') return false
    let test
    test = src.startsWith('nobody/') ? src.slice('nobody/'.length) : src
    if (test.length === 0 || test.split('/').length > 1) return false
    return true
  }

  const validateDst = (dst) => {
    if (typeof dst === 'string' && validator.isUUID(dst)) return true    
    return false
  }

  if (!req.body || typeof req.body !== 'object')
    return res.status(500).end()

  let { src, dst } = req.body
  
  if (!validateSrc(src) || !validateDst(dst))
    return res.status(500).end()

  let node = filer.findNodeByUUID(dst)
  if (!node || !node.isDirectory()) 
    return res.status(500).end()

  let dstDirPath = node.namepath()
  let dstname = src.startsWith('nobody/') ? src.slice('nobody/'.length) : src

  fs.readdir(dstDirPath, (err, entries) => {

    if (err) return res.status(500).end()
    dstname = renameIfExists(entries, dstname)
 
    let srcpath = path.join(vroot, src)
    let dstpath = path.join(dstDirPath, dstname)    

    console.log(`**** moving ${srcpath} to ${dstpath} ****`)
    fs.rename(srcpath, dstpath, err => {

      if (err) return res.status(500).end()
      repo.inspect(node.uuid)
      setTimeout(() => res.status(200).end(), 3000)
    })
  })
})

export default router
