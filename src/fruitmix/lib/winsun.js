import { list } from './fstree' 

const scan = (root, callback) => {

  let paths = []
  let nodes = []

  list(root, 2, (err, node) => {

    if (err) return callback(err)    
    node.children.forEach(sub => {
      
      if (sub.type !== 'folder') return
      if (sub.name === 'wisnuc') return
      if (sub.name === 'timemachine') return
      if (sub.name === 'nobody') {
        if (sub.children) {
          sub.children.forEach(subsub => {
            if (subsub.type !== 'folder') return
            paths.push(subsub.path)
          })
        }
        return
      }

      paths.push(sub.path)       
    }) 

    // now we have personal && shared paths 
    if (paths.length === 0) return callback(null, [])
    let count = paths.length
    paths.forEach(dirpath => {
      list(dirpath, 3, (err, tree) => {
        if (!err) nodes.push(tree)
        if (!--count) return callback(null, nodes)
      })
    })
  }) 
}

const visit = (node, func) => {

  if (node.children) {
    node.children.forEach(child => visit(child, func))
  }

  func(node)
}

const scan2 = (root, callback) => {

  scan(root, (err, nodes) => {

    if (err) return callback(err)
    nodes.forEach(node => {
      visit(node, n => n.path = n.path.slice(root.length + 1))
    })     
    callback(null, nodes)
  })
}

export default scan2
