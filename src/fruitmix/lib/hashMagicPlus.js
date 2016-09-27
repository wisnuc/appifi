var fs = require('fs')
var child = require('child_process')

module.exports = (target, uuid, callback) => {

  let hash = null, magic = null, timestamp, finished = false
  let file, openssl
  let count = 2

  fs.stat(target, (err, stats) => {

    if (finished) return
    if (err) return CALLBACK(err)
    if (!stats.isFile()) return einval('must be a file') 
   
    timestamp = stats.mtime.getTime() 
    
    openssl = child.spawn('openssl', ['dgst', '-sha256', '-r', target])
    openssl.stdout.on('data', data => hash = data.toString().trim().slice(0, 64))
    openssl.on('close', code => {
      openssl = null
      if (code !== 0) hash = null
      if (!finished) END()
    }) 

    file = child.spawn('file', ['-b', target])
    file.stdout.on('data', data => magic = data.toString().trim())
    file.on('close', code => {
      file = null
      if (code !== 0) magic = null
      if (!finished) END()
    })
  })

  return () => {
    if (finished) return
    if (openssl) openssl.kill()
    if (file) file.kill()
    finished = true
  }

  function CALLBACK(err, res) {
    finished = true
    callback(err, res)
  }

  function einval(text) {
    CALLBACK(Object.assign(new Error(text)), { code: 'EINVAL' })
  }

  function END() {
    if (finished) return
    if (!--count) CALLBACK(null, { 
      target,
      uuid,
      hash, 
      magic, 
      timestamp, 
    })
  }
}





