import path from 'path'
import EventEmitter from 'events'
import deepEqual from 'deep-equal'

import magicMeta from './magicMeta' 

// These are tree node operations
const nodeProperties = {

  root() {
    let node = this
    while (node.parent !== null) node = node.parent
    return node
  },

  nea() {
    let node = this  
    while (!node.writelist) node = node.parent
    return node
  },

  isRootOwner(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1
    )
  }, 

  userWritable(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1 ||
      this.nea().writelist.indexOf(userUUID) !== -1
    )
  },

  userReadable(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1 ||
      this.nea().writelist.indexOf(userUUID) !== -1 ||
      this.nea().readlist.indexOf(userUUID) !== -1
    )
  },

  setChild(child) {
    this.children ? this.children.push(child) : this.children = [child]
  },

  unsetChild(child) {
    let children = this.children
    if (children === undefined) throw new Error('Node has no children')
    let index = children.findIndex(c => c === child)
    if (index === -1) throw new Error('Node has no such child')
    children.splice(index, 1)
    if (children.length === 0) delete this.children 
  },

  getChildren() {
    return this.children ? this.children : []
  },

  attach(parent) {
    if (this.parent) throw new Error('node is already attached')
    this.parent = parent
    parent.setChild(this)
  },

  detach() {
    if (this.parent === null) throw new Error('Node is already detached')
    this.parent.unsetChild(this)
    this.parent = null   
  },

  upEach(func) {
    let node = this
    while (node !== null) {
      func(node)
      node = node.parent
    }
  },

  upFind(func) {
    let node = this
    while (node !== null) {
      if (func(node)) return node
      node = node.parent
    }
  },

  nodepath() {
    let q = []
    this.upEach(node => q.unshift(node))
    return q
  }, 

  namepath() {
    return path.join(...this.nodepath().map(n => n.name))
  },

  preVisit(func) {
    func(this)
    if (this.children) 
      this.children.forEach(child => child.preVisit(func)) 
  },

  postVisit(func) {
    if (this.children)
      this.children.forEach(child => child.postVisit(func))
    func(this) 
  },

  preVisitEol(func) {
    if (func(this) && this.children)
      this.children.forEach(child => child.preVisitEol(func))  
  },

  preVisitFind(func) {
    if (func(this)) return this
    if(this.children === undefined) return undefined
    return this.children.find(child => child.preVisitFind(func))
  },

  isFile() {
    return this.type === 'file'
  },

  isDirectory() {
    return this.type === 'folder'
  }
}

// to prevent unexpected modification
Object.freeze(nodeProperties)

class IndexedTree extends EventEmitter {

  // proto can be any plain JavaScript object
  // root should have at least the uuid for this general data structure
  // for fruitmix specific usage, root should have owner, writelist and readlist
  constructor(proto) {

    super()    
    this.proto = Object.assign(proto, nodeProperties)

    // for accessing node by UUID
    this.uuidMap = new Map()
    // file only, examine magic and conditionally put node into map
    this.hashMap = new Map()
    // file only, for file without hashmagic
    this.hashless = new Set()
    // for digestObj with extended meta but not sure if it has been extracted before
    this.extended = new Set()
    // folder only, for folder with writer/reader other than drive owner
    this.shared = new Set()

    this.roots = []
  } 

  // parent, children 
  // uuid, type
  // owner, writelist, readlist
  // mtime, size
  // hash

  // using whitelist for props, aka, builder pattern, this will
  // ease the indexing maintenance when updating props
  createNode(parent, props) {

    // create empty object
    let node = Object.create(this.proto)

    // set uuid
    if (!props.uuid) throw new Error('props must have uuid property')
    node.uuid = props.uuid 

    // set type
    if (!props.type) throw new Error('props must have type property')
    if (props.type !== 'file' && props.type !== 'folder') throw new Error('type must be file or folder')
    if (parent === null && props.type !== 'folder') throw new Error('root object type must be folder')
    node.type = props.type

    // set name
    if (!props.name || typeof props.name !== 'string' || !props.name.length)
      throw new Error('name must be non-empty string')
    node.name = props.name

    // set owner if different from proto
    if (!props.owner || !Array.isArray(props.owner))
      throw new Error('owner must be an array')
    if (parent === null && !props.owner.length)
      throw new Error('root owner cannot be empty')

    node.owner = props.owner

    if (parent === null) {
      if (!props.writelist || !Array.isArray(props.writelist))
        throw new Error('root writelist must be an array')
      if (!props.readlist || !Array.isArray(props.readlist))
        throw new Error('root readlist must be an array')
    }
    else {
      if (props.writelist && !Array.isArray(props.writelist))
        throw new Error('writelist must be an array if defined')
      if (props.readlist && !Array.isArray(props.readlist))
        throw new Error('readlist must be an array if defined')

      if (!!props.writelist !== !!props.readlist)
        throw new Error('writelist and readlist must be either defined or undefined together')
    }

    // set writelist and readlist if any
    if (props.writelist) {
      node.writelist = props.writelist
      node.readlist = props.readlist
    }

    // size and mtime
    if (node.isFile()) {
      node.size = props.size
      node.mtime = props.mtime
    }

    // set structural relationship
    if (parent === null) {
      node.parent = null // TODO: should have a test case for this !!! this may crash forEach
    }
    else {
      node.attach(parent)
    }
     
    // set uuid indexing
    this.uuidMap.set(node.uuid, node)

    // set digest indexing for file, or shared for folder
    if (node.isFile()) {
      this.fileHashInstall(node, props.hash, props.magic)
    }
    else if (node.isDirectory()) {
      if (node.writelist) this.shared.add(node)  
    }

    if (parent === null) this.roots.push(node)
    return node
  }

  fileHashInstall(node, hash, magic) {

    if (!hash) {
      this.hashless.add(node)

      // TODO
      // this is probably not the best place to emit since the content update is not finished yet.
      this.emit('hashlessAdded', node)
      return
    }
    
    let digestObj = this.hashMap.get(hash)
    if (digestObj) {
      digestObj.nodes.push(node)
      return 
    } 

    let meta = magicMeta(magic)
    if (meta) {
      node.hash = hash
      digestObj = {
        meta,
        nodes: [node]
      }
      this.hashMap.set(hash, digestObj)
      if (meta.extended) {
        this.extended.add(digestObj)
        this.emit('extendedAdded', digestObj)
      }
    }
  }

  fileHashUninstall(node) {

    // if no hash
    if (!node.hash) {
      if (this.hashless.has(node)) {
        this.hashless.delete(node)
      }
      return
    }

    // let hash = node.hash // TODO

    // retrieve digest object
    let digestObj = this.hashMap.get(node.hash)
    if (!digestObj) throw new Error('hash (' + node.hash + ') not found in hashmap)')
    
    // find in node array
    let index = digestObj.nodes.find(x => x === node)
    if (index === -1) throw new Error('hash (' + node.hash + ') not found in digest object node array')

    // remove and delete hash property
    digestObj.nodes.splice(index, 1)
    delete node.hash

    // destory digest object if this is last one
    if (digestObj.nodes.length === 0) {
      // try to remove it out of extended (probably already removed)
      if (digestObj.meta.extended) this.extended.delete(digestObj)
      this.hashMap.delete(node.hash)
    }
  }

  // actually all operation should update file/folder on disk first,
  // then readback xstat, so this is the only method to update node
  updateNode(node, props) {

    if (props.uuid !== node.uuid || props.type !== node.type)
      return false

    if (node.isDirectory()) {

      node.owner = props.owner 
      node.writelist = props.writelist      
      node.readlist = props.readlist
      node.name = props.name

      if (node.writelist)
        this.shared.add(node)
      else
        this.shared.delete(node)
    }
    else if (node.isFile()) {

      this.fileHashUninstall(node)
      
      node.owner = props.owner  
      node.writelist = props.writelist
      node.readlist = props.readlist
      node.name = props.name
      node.mtime = props.mtime
      node.size = props.size
      
      this.fileHashInstall(node, props.hash, props.magic)
    }
    else {
      // throw an error?
    }

    return true
  }

  // this function delete one leaf node
  // for delete a sub tree, using higher level method
  deleteNode(node) {

    if (node.children) throw new Error('node has children, cannot be deleted')

    if (node.isFile()) {
      this.fileHashUninstall(node)
    }
    else if (node.isDirectory()) {
      this.shared.delete(node) // ignore true or false
    }
    
    this.uuidMap.delete(node.uuid) 
    if (node === this.root) {
      this.root = null
    }
    else {
      node.detach()
    }
  }

  deleteNodeByUUID(uuid) {
    let node = this.uuidMap.get(uuid)
    if (!node) return null
    this.deleteNode(node)
  }

/**
  deleteSubTree(node) {
    node.postVisit(n => this.deleteNode(n)) 
  }
**/

  deleteSubTree(node) {

    if (node.parent === null) return

    node.postVisit(n => {
      if (n.isFile()) {
        this.fileHashUninstall(n) 
      } 
      else if (n.isDirectory()) {
        this.shared.delete(n)
      }
    })

    node.detach()
  }

  findNodeByUUID(uuid) {
    return this.uuidMap.get(uuid)
  }
}

export { nodeProperties, IndexedTree } 

