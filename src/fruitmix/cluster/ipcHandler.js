class IpcHandler {

  constructor() {
    this.commandMap = new Map()
  }

  register(key, val) {
    this.commandMap.set(key, val)
  }

  registerMap(map) {
    this.commandMap = new Map([...this.commandMap, ...map])
  }

  // no id is illegal
  handleCommand(worker, msg) {

    let { id, op, args } = msg
    let handler = this.commandMap.get(op)

    if (!handler) {
      return worker.send({
        type: 'command',
        id,
        err: {
          code: 'ENOHANDLER',
          message: `no handler found for ${op}`
        }
      })
    }

    handler(msg.args, (err, data) => {

      console.log('handler', err || data)

      if (err) {
        worker.send({
          type: 'command',
          id: id,
          err: {
            code: err.code,
            message: err.message
          }
        })
      }
      else {
        worker.send({ type: 'command', id, data })
      }
    })
  }

  handle(worker, msg) {
    switch(msg.type) {
      case 'command':
        this.handleCommand(worker, msg)
        break
      default:
        break
    }
  }
}

const createIpcHandler = () => new IpcHandler()

export default createIpcHandler
