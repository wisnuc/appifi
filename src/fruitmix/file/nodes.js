import validator from 'validator'

class Node {

  constructor(props) {
    // TODO
    Object.assign(this, props)
    this.parent = null
    this.children = [] // new Set
  }

  attach(parent) {
    if (this.parent) throw new Error('node is already attached')
    this.parent = parent
    parent.setChild(this)
  }

  detach() {
    if (this.parent === null) throw new Error('Node is already detached')
    this.parent.unsetChild(this)
    this.parent = null   
  }

  setChild(child) {
    this.children ? this.children.push(child) : this.children = [child]
  }

  unsetChild(child) {

    let children = this.children
    if (children === undefined) 
      throw new Error('Node has no children')

    let index = children.findIndex(c => c === child)
    if (index === -1) throw new Error('Node has no such child')
    children.splice(index, 1)

    if (children.length === 0) 
      delete this.children 
  }

  root() {
    let node = this
    while (node.parent !== null) node = node.parent
    return node
  }

  nea() {
    let node = this  
    while (!node.writelist) node = node.parent
    return node
  }

  isRootOwner(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1
    )
  } 

  userWritable(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1 ||
      this.nea().writelist.indexOf(userUUID) !== -1
    )
  }

  userReadable(userUUID) {
    return (
      this.root().owner.indexOf(userUUID) !== -1 ||
      this.nea().writelist.indexOf(userUUID) !== -1 ||
      this.nea().readlist.indexOf(userUUID) !== -1
    )
  }

  // always return array
  getChildren() {
    return this.children ? this.children : [] 
  }

  upEach(func) {
    let node = this
    while (node !== null) {
      func(node)
      node = node.parent
    }
  }

  upFind(func) {
    let node = this
    while (node !== null) {
      if (func(node)) return node
      node = node.parent
    }
  }

  nodepath() {
    let q = []
    this.upEach(node => q.unshift(node))
    return q
  } 

  namepath() {
    return path.join(...this.nodepath().map(n => n.name))
  }

  walkDown(names) {
    if (names.length === 0) return this
    let named = this.getChildren().find(child => child.name === names[0])
    if (!named) return this
    return named.walkDown(names.slice(1))
  }

  preVisit(func) {
    func(this)
    if (this.children) 
      this.children.forEach(child => child.preVisit(func)) 
  }

  postVisit(func) {
    if (this.children)
      this.children.forEach(child => child.postVisit(func))
    func(this) 
  }

  preVisitEol(func) {
    if (func(this) && this.children)
      this.children.forEach(child => child.preVisitEol(func))  
  }

  preVisitFind(func) {
    if (func(this)) return this
    if (this.getChildren().length === 0) return undefined
    return this.children.find(child => child.preVisitFind(func))
  }

  isFile() {
    return this.type === 'file'
  }

  isDirectory() {
    return this.type === 'folder'
  }
}

class FileNode extends Node {

  constructor(props) {
    super(props)
  }

  hash() {
  }

  identify() {
  }
} 

const createFileNode = (props) => {

  let node = new FileNode(props)  
  if (node.type === 'JPEG') {
        
  }
}

class DirectoryNode extends Node {

  constructor(props) {
    super(props)    
    this.state = 'IDLE'
  }

  requestProbe() {
  }
}

const createDirectoryNode = () => {
}

class DriveNode extends DirectoryNode {
  constructor(props) {
    super() 
    
  }
}

const createDriveNode = () => {
}
