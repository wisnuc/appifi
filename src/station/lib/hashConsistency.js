// const XXHASH = require('xxhash')
const crypto = require('crypto')


// return number
let HashFunc = (key) => {
  let h = crypto.createHash('sha256')
  h.update(new Buffer(key))
  return Math.abs(h.digest().readInt32LE()%1024)
}

/**
 *  node maybe cloud address
 *  key maybe station id
 */
class HashConsistency {
  constructor() {
    this.nodeMap = []
    this.replicas = 1
    this.nodes_replicas = new Map()
    this.nodes = undefined
  }

  init(nodes, replicas) {
    this.nodes = nodes
    this.replicas = replicas
    if(nodes)
      nodes.forEach(node => {
        this._addToMap(node)
      });
    this._sort()
  }

  getNode(key) {

    let keyHash = HashFunc(key)

    for(let i =0; i < this.nodeMap.length; i ++) {
      if(this.nodeMap[i][0] > keyHash )
        return this.nodes_replicas.get(this.nodeMap[i][1])
    }

    return this.nodes_replicas.get(this.nodeMap[0][1])
  }

  addNode(node) {

  }

  removeNode(node) {

  }

  _sort() {
    this.nodeMap.sort((a, b) => a[0] > b[0])
  }

  _addToMap(node) {
    let node_reps = [] // 定义 一个node 对应一个集合 
    for(let i = 0; i < this.replicas; i++) {
      let rep_node = node + '__' + i
      let nodeHash = HashFunc(rep_node) // 计算哈希值 
      this.nodeMap.push([nodeHash, node]) // 把 对应的 位置 和值 记录
      node_reps.push(nodeHash)
    }
    this.nodes_replicas.set(node, node_reps)
  }
}

let nodes = [
  'www.jackyang.cn',
  'www.baidu.cn',
  'www.sina.cn',
  'www.wisnuc.cn',
  'www.hao123.com'
]

let stationId = '1122222222211111qweqwe'

let hashConsistency = new HashConsistency()

hashConsistency.init(nodes, 1)

console.log(hashConsistency.getNode(stationId))

console.log(HashFunc(stationId))

console.log(hashConsistency.nodeMap)

console.log(hashConsistency.nodes_replicas)

