import path from 'path'
import fs from 'fs'
import readline from 'readline'

const createUUIDLog = (dirpath) => {

  const dir = dirpath 

  return {

    append(uuid, data, callback) {

      let text = data.split('\n')[0].trim()
      if (text.length === 0)
        return process.nextTick(callback, null)

      let abort = false
      let os = fs.createWriteStream(path.join(dir, uuid), { flags: 'a' }) 
      os.on('error', error => {
        if (abort) return
        abort = true
        callback(error) 
      })

      os.on('close', () => {
        if (abort) return
        callback(null)
      })
      os.write('\n')
      os.write(text)
      os.end()
    },

    get(uuid, callback) {

      let arr = []
      let abort = false

      let input = fs.createReadStream(path.join(dir, uuid))
      input.on('error', err => {
        if (abort) return
        abort = true
        err.code === 'ENOENT' ? callback(null, []) : callback(err) 
      })
      
      const rl = readline.createInterface({ input }) 

      rl.on('error', err => {
        if (abort) return
        abort = true
        callback(err)
      })

      rl.on('line', line => {
        if (abort) return
        if (line.trim().length)
          arr.push(line.trim())
      })

      rl.on('close', () => {
        if (abort) return
        callback(null, arr)
      })
    }
  }
}

export default createUUIDLog

