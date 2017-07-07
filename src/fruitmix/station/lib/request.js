const request = require('superagent')

module.exports = (type, url, params, opts, callback) => {
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
    default:
      break
  }


  if(params)
    req.send(params)

  if(opts)
    for(let i in opts){
      if (opts.hasOwnProperty(i))
          req.set(i, opts[i])
    }
  req.end(callback)
}