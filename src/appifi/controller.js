class Appifi extends EventEmitter {

  constructor(child) {
    super()

    this.child = child
    this.state = 'starting'

    this.child.on('error', err => {
      this.error = err
    })

    this.child.on('message', message => {
      switch (message.type) {
        case 'appifiStarted':
          this.state = 'started'
          break
        }
    })

    this.child.on('exit', (code, signal) => {
      this.state = 'exited'
      this.code = code
      this.signal = signal
    })

    this.callback = null
  }

  getState() {

    let obj = { state: this.state }
    
    if (this.error)
      obj.error = {
        code: this.error.code,
        message: this.error.message
      }

    if (this.state === 'exited')
      obj.exit = {
        code: this.code,
        signal: this.signal
      }

    return obj
  }
}

const fork = cfs => {

	let froot = path.join(cfs.mountpoint, 'wisnuc', 'fruitmix')
	let modpath = path.resolve(__dirname, '../../fruitmix/main')

	console.log(`forking fruitmix, waiting for 120s before timeout`)

  return new Fruitmix(child.fork(modpath, ['--path', froot], { 
		env: Object.assign({}, process.env, { FORK: 1 }),
		stdio: ['ignore', 1, 2, 'ipc'] 		// this looks weird, but must be in this format, see node doc
	}))
}

module.exports = {
  probeAsync,
  sambaAudit,
  fork,
}