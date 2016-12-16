import EventEmitter from 'events'

import { createNode } from './node'

// observable
class Forest extends EventEmitter {
  
  constructor() {
    super()
    this.roots = []
    this.uuidMap = new Map()
    this.nodeListeners = []
  }

  registerNodeListener(listener) {
    this.nodeListeners.push(listener)
  }

  // 1. return a node if success, or undefined / null if failed
  addNode(parent, props) {

    if (parent !== null) throw new Error('not implemented yet')
    let node = createNode(props)      
    if (!node) return
    this.roots.push(node)
    this.uuidMap.set(node.uuid, node)
    this.nodeListeners.forEach(l => l.nodeAdded && l.nodeAdded(node))
  }

  updateHashMagic(node, hash, magic) {
    let newProps = Object.assign({}, node.props, { hash, magic }) 
    this.updateProps(node, newProps)
  }

  updateProps(node, newProps) {
    let oldProps = node.props  1
    node.props = newProps
    this.nodeListeners.forEach(l => l.nodePropsUpdated && l.nodePropsUpdated(oldProps, newProps))
  }
}

// key: digest (sha256), 
// value: container, media type, in-file metadata, digest
// nodes[] file/forest module reference
class Digester {

  constructor(forest) {
    this.map = new Map()     
    this.forest = forest
    forest.registerNodeListener(this)
  } 

  nodeAdded(node) {
    console.log(`node with uuid ${node.uuid} added`)
    
    if (node.type === 'file' &&
        node.hash && 
        node.magic.startsWith('JPEG')) {

      let container = this.map.get(node.hash)   
      if (container) {
        container.nodes.push(node)
      }
      else {
        container = {
          digest: node.hash,
          type: 'JPEG',
          metadata: null,
          nodes: [node]
        }

        this.map.set(node.hash, container)
      }
    }
  }


  nodeHashMagicUpdate() {
  }
}

  (async () {})()

// inheritance vs composition
class HashMagicFactory extends Scheduler {

  constructor(forest) {
    this.forest = forest
    forest.registerNodeListener(this)

    this.scheduler = new Scheduler()
  }

  nodeAdded(node) {
    if (node.type === 'file' && !node.hash) {
      calcHashMagic(node, (err, hash, magic) => {
        if (err) return
        this.forest.updateHashMagic(node, hash, magic)
      })
    }
  }

  nodeDeleted(node) {
  }
}

  let handle = child.spawn('shell command', (err, stdout) => {
  })

  handle.kill()

  {
    run
    pause
    resume
    abort
  }

function createTask(taskObj, callback) {

  let task = {
    id : UUID.v4(),
    taskFunc,
    callback, 
    status: 'ready'
  }

  taskQueue.push(task)
  return task.id
}

function schedule() {
  
  const limit = 4

  while (taskQueue.filter(task => task.status === 'busy').length < 4) {
    let readyToRun = taskQueue.find(task => task.status === 'ready')
    if (!readyToRun) return

    readyToRun.taskFunc((err, data) => {
      readyToRun.callback(err, data)
      
      let index = taskQueue.indexOf(readyToRun)
      splice
      schedule()
    })
  }
}


HashMagicWorker, schedule, abort


let forest = new Forest()
let digester = new Digester(forest)
let props = {
  uuid: 'b1787f20-24c7-4a03-8d81-906827ea6431',
  type: 'file',
  name: 'hello',
  mtime: 123,
  size: 456,
  hash: '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be',
  magic: 'JPEG image data' 
}




