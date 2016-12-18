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
    let oldProps = node.props
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



