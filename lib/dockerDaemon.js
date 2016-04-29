'use strict'

const fs = require('fs')
const child = require('child_process')

/* state machine
 * 
 * stopped: (if never started)
            exitcode -> -1
            handle -> null
            directory -> ''
            (if started then stopped)
            exitcode -> last exit code
            handle -> null
            directory -> last working directory
   started: 
            exitcode -> -1
            handle -> spawn
            directory -> working directory
 */
            
let service = {
  status: 'STOPPED',
  exitcode: -1,
  handle: null,
  directory: ''
}

/*
 * operation only valid for stopped
 */
let start = (directory, callback) => {

  if (service.status === 'STARTED') {
    return callback('INVALID_OP', 'service already started')
  }

  if (!((typeof directory === 'string' || directory instanceof String) && directory.startsWith('/'))) {

    return callback('INVALID_PARAM', 'directory must be an absolute path')
  }

  fs.stat(directory, (err, stats) => {

    if (err) return callback(err, null)
    if (!stats.isDirectory()) return callback('INVALID_PARAM', 'not a directory')

    directory = directory.endsWith('/') ? directory : directory + '/'

    let opts = {
      cwd: directory
    }
   
    let root = directory + 'root'
    let graph = directory + 'graph'
    let pidfile = directory + 'pidfile'

    let args = []
    args.push('daemon')
    args.push('--exec-root="' + root + '"')
    args.push('--graph="' + graph + '"')
    args.push('--host="127.0.0.1:1688"')
    args.push('--pidfile="' + pidfile + '"')

    let daemon=child.spawn('docker', args, opts)

    daemon.on('error', (err) => {
      
      service.status = 'STOPPED'
      service.exitcode = 999
      service.handle = null
      callback('INTERNAL_ERROR', err)
    })

    daemon.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)        
    })

    daemon.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`)
    })

    daemon.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
      service.status = 'STOPPED'
      service.exitcode = code
      service.handle = null
    })

    service.status = 'STARTED'
    service.exitcode = -1
    service.handle = daemon
    service.directory = directory 
  })
}

let stop(callback) {

  if (service.status === 'STOPPED') {
    callback(null, null)
  }

   
}

start('/home/xenial/tmp', function(err, result) { console.log(err); console.log(result) })

