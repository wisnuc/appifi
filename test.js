
var stream = require('stream')
var readline = require('readline')
var request = require('superagent')
var createStore = require('redux').createStore

/*  { status: 'Downloading',
      progressDetail: { current: 1963551, total: 8720173 },
      progress: '[===========>                                       ] 1.964 MB/8.72 MB',
      id: 'ccf97cb94923' } */

const reducer = (state = [], msg) => {

  console.log(msg)

  if (msg.type !== 'type') return state
  if (msg.status === 'Downloading') {

    let index = state.findIndex(item => item.id === msg.id)
    if (index === -1) {
      return  [
                ...state, 
                {
                  id : msg.id,
                  current : msg.progressDetail.current,
                  total: msg.progressDetail.total
                }
              ]
    }

    if (state[index].current === msg.progressDetail.current)
      return state

    return [
      ...state.slice(0, index), 
      Object.assign({}, state[index], { current: msg.progressDetail.current }),
      ...state.slice(index + 1)
    ]
  }
  else if (msg.status === 'Download complete') {

    let index = state.findIndex(item => item.id === msg.id)

    if (index === -1) return state
    
    // remove
    return [
      ...state.slice(0, index),
      ...state.slice(index + 1)
    ]
  }
  else if (msg.status === 'Already exists' ||
    msg.status === 'Waiting' ||
    msg.status === 'Verifying Checksum' ||
    msg.status === 'Pulling fs layer') {

    return state
  }
  console.log(msg)
  return state
}

var store = createStore(reducer)

let createLogger = () => {

  var old = null
  return function() {

    if (old !== store.getState()) {
      old = store.getState()
      console.log(old)
    }
  }
}

store.subscribe(createLogger()) 

var transform = new stream.Transform({ 
  transform: function (chunk, encoding, callback) {
    this.push(chunk)
    callback()
  },
})

var rl = readline.createInterface({input: transform})

rl.on('line', (line) => { 
  // TODO catch err, stop or neglect?
  var msg = JSON.parse(line)
  msg.type = 'type'
  store.dispatch(msg)  
})

var req = request
  .post('http://127.0.0.1:1688/images/create?fromImage=busybox&tag=latest')
  .pipe(transform)



