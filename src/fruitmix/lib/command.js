import child from 'child_process'

import E from '../lib/error'

// cmd must be a string
// args must be a string array
const command = (cmd, args, callback) => {

  let output, aborted = false
  let handle = child.spawn(cmd, args)

  handle.stdout.on('data', data => {
    if (aborted) return
    output = data
  })

  handle.on('close', (code, signal) => {

    handle = null

    if (aborted) return
    if (signal) 
      return callback(new E.EEXITSIGNAL(`exit with signal ${signal}`))
    if (code) 
      return callback(new E.EEXITCODE(`exit with code ${code}`))

    callback(null, output.toString())
  })

  function abort() {

    // avoid duplicate abort
    if (aborted) return

    if (handle) {
      handle.kill()
      handle = null
    }

    aborted = true
    callback(new E.EABORT())
  }

  return abort
}

export default command

