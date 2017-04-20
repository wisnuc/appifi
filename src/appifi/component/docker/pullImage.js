import EventEmitter from 'events'
import Debug from 'debug'
const PULL_IMAGE = Debug('APPIFI:PULL_IMAGE')

import dockerAgent from './dockerAgent'
import { createStore } from '../../lib/redux'

class pullImage extends EventEmitter {

  constructor(image, tag, callback) {

    super()

    this.image = image
    this.tag = tag
    this.agent = null

    this.status = 'started'
    this.error = null
    this.message = null

    this.state = null
    this.store = createStore(this.reducer.bind(this)) // bound
    this.store.subscribe(() => { 
      if (this.state !== this.store.getState()) {
        this.state = this.store.getState()
        this.emit('update', this.state) 
      } 
    })

    let url = `/images/create?fromImage=${this.image}&tag=${this.tag}`
    dockerAgent.post(url, (e, agent) => {

      if (e) return callback(e)
      agent.on('json', msg => this.store.dispatch(msg))
      agent.on('close', () => this.emit('close'))

      this.agent = agent
      callback(null, this)
    })
  }

  abort() {
    if (this.agent) this.agent.abort()
  }

  reducer(state, msg) {

    if (msg.status === undefined) 
      return Object.assign({}, state, {
        from: null,
        threads: [],
        digest: null,
        status: null
      })

    if (msg.status.startsWith('Pulling from') || 
        msg.status.startsWith('Pulling repository')) {
      return Object.assign({}, state, { from: msg.status })
    }

    if (msg.status.startsWith('Digest: ')) {
      return Object.assign({}, state, { digest: msg.status })
    }

    if (msg.status.startsWith('Status: Downloaded newer image for') ||
        msg.status.startsWith('Status: Image is up to date')) {
      return Object.assign({}, state, { status: msg.status })
    }

    // test thread in a permissive way
    let regex = /^[a-f0-9]+$/
    if (msg.id && msg.id.length === 12 && regex.test(msg.id)) {
      let index = state.threads.findIndex(t => t.id === msg.id)
      if (index === -1) {
        let threads = [...state.threads, msg]
        return Object.assign({}, state, { threads })
      }
      else {
        let threads = [...state.threads.slice(0, index),
            msg, 
            ...state.threads.slice(index + 1)]
        return Object.assign({}, state, { threads })
      }
    }

    PULL_IMAGE('--- unexpected message') 
    PULL_IMAGE(msg)
    PULL_IMAGE('--- unexpected message end')
    
    return state
  }
}

export default (image, tag, callback) => new pullImage(image, tag, callback)     



