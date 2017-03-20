import child from 'child_process'
import E from '../lib/error'

// cmd must be a string
// args must be a string array
const command = (cmd, args, callback) => {

  let output, h, finished = false

  const finalize = () => finished = (h && h.kill()) || true
  const error = err => finalize() && callback(err)
  const finish = data => finalize() && callback(null, data)

  h = child.spawn(cmd, args)
  h.stdout.on('data', data => !finished && (output = data))
  h.on('close', (code, signal) => 
    finished ? undefined
      : signal ? error(new E.EEXITSIGNAL(`exit with signal ${signal}`))
        : code !== 0 ? error(new E.EEXITCODE(`exit with code ${code}`))
          : finish(output.toString()))

  return () => !finished && error(new E.EABORT())
}

export default command







