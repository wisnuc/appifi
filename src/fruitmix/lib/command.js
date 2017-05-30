const child = require('child_process')
const E = require('./error')

/**
Exports a single function for running command.

@module command
*/

/**
`command` is a simple version of state-machine based worker class.

It uses `child.spawn` internally and return an abort function. When aborting, a `EABORT` error is returned via callback function. This behavior is consistent with that of worker class.

For running a shell command where `child.exec` is not applicable and worker class overkills, `command` is the right choice.

@function command
@param {string} cmd - command
@param {string[]} args - command args
@param {function} callback - `(err, 
@returns {function} abort function, can be used to abort this command.
*/
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

module.exports = command
