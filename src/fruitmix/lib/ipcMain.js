import cluster from 'cluster'


let start = () => {
  for(const id in cluster.workers){
    let worker = cluster.workers[id]
    worker.on('message', messageHandle(worker))
  }
}

let commandMap = new Map()

/**
 * msg:
 * 
 * type:' '
 * op:' '
 * args:{}
 * uuid
 * 
 */

const errorObj =  (id, err) => {
  return {
    id,
    err: {
      code: err.code,
      message: err.message
    }
  }
}

const messageHandle = worker => (msg) => {
  let { type, op, args, id } = msg
  // if(msg.type !== 'command')
  //   return errorObj('type error', )
  if (!id) {
    let handler = commandMap.get(op)
    if (handler) {
      handler(args, (err, data) => {
        console.log('command not reply', msg)
      })
    }
    return
  }
  
  let handler = commandMap.get(op)

  if (handler) {
    handler(args, (err, data) => {
      if (err) {
        console.log('command handler error', err)
        worker.send(errorObj(id, err))
      }else{
        worker.send({ id, data })
      }
    })
  }
  else {
    console.log('reply command handler not found', id, op)
    worker.send({ 
      id,
      err: {
        code: 'ENOCOMMAND',
        message: `command ${op} not found`
      },
  })
  }
} 

const registerCommandHandlers = map => {
  map.forEach((val, key) => commandMap.set(key, val))
}

export default { registerCommandHandlers, start }