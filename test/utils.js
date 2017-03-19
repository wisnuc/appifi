import fs from 'fs'

const cp = (src, dst, callback) => {

  let finished = false

  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)

  const finish = err => {
    if (finished) return
    finished = true
    callback(err)
  }

  rs.on('error', err => finish(err))
  ws.on('error', err => finish(err)) 
  ws.on('close', () => finish())
  rs.pipe(ws)
}

const cpAsync = Promise.promisify(cp)

export { cp, cpAsync }

