const fs = require('fs')

const request = require('superagent')
const Promise = require('bluebird')

let requestHelper =  (type, url, { params, query }, opts, callback) => {
  let req
  if(typeof type !== 'string' || !type.length || typeof url !== 'string' || !url.length)
    return callback(new Error('args error'))
  switch (type) {
    case 'POST':
    case 'post':
      req = request.post(url)
      break
    case 'GET':
    case 'get':
      req = request.get(url)
      
      break
    case 'DELETE':
    case 'delete':
      req = request.delete(url)
      break
    case 'PUT':
    case 'put':
      req = request.put(url)
      break
    case 'PATCH':
    case 'patch':
      req = request.patch(url)
      break
    default:
      break
  }


  if(params)
    req.send(params)
  if(query)
    req.query(query)

  if(opts)
    for(let i in opts){
      if (opts.hasOwnProperty(i))
          req.set(i, opts[i])
    }
  req.end(callback)
}

module.exports.requestHelper = requestHelper

module.exports.requestHelperAsync = Promise.promisify(requestHelper)

module.exports.download = (url, params, fpath, opts, callback) => {
  let req = request.get(url)
  if(params)
    req.send(params)
  if(opts)
    for(let i in opts){
      if (opts.hasOwnProperty(i))
          req.set(i, opts[i])
  }
  try{
    let writeable = fs.createWriteStream(fpath)
  }catch(e){
    return callback(e)
  }

  let abort = false

  req.on('finish', () => {
    if(abort) return 
    return callback(null)
  })

  req.on('error', err => {
    if(abort) return 
    abort = true
    return callback(err)
  })

  req.pipe(writeable)
}

module.exports.upload = (url, params, fpath, opts, callback) => {
  let req = request.put(url)
  if(params)
    req.send(params)
  if(opts)
    for(let i in opts){
      if (opts.hasOwnProperty(i))
          req.set(i, opts[i])
  }
  try{
    let readable = fs.createReadStream(fpath)
  }catch(e){
    return callback(e)
  }

  let abort = false

  req.on('finish', () => {
    if(abort) return 
    return callback(null)
  })

  req.on('error', err => {
    if(abort) return 
    abort = true
    return callback(err)
  })

  readable.pipe(req)
}