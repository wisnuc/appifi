import stream from 'stream'
import readline from 'readline'
import request from 'superagent'
import EventEmitter from 'events'

import dockeragent from './dockeragent'
import createStore from './reduced'
import { HttpRequestError, HttpResponseError, JSONParserError } from './error'

class dockerImageCreator extends EventEmitter {

  static create(image, tag) {
    let creator = new dockerImageCreator(image, tag)
    return creator
  }

  constructor(image, tag) {
    super()
    this.image = image
    this.tag = tag
    this.observe = observe
    this.state = null
    this.store = createStore(this.reducer.bind(this)) // bound
    this.store.subscribe(() => { 
      if (this.state !== this.store.getState()) {
        this.state = this.store.getState()
        this.emit('update', this.state) 
      } 
    })

    this.agent = dockeragent
      .post(`/images/create?fromImage=${this.image}&tag=${this.tag}`)
      .on('message', msg => this.store.dispatch(msg))
      .on('error', err => {
        console.log(err)
      })
      .on('disconnect', () => {
        this.store.dispatch('disconnect')
        this.emit('disconnect')
      })
  }

  reducer(state, msg) {

    if (msg === 'disconnect') {
      console.log('message is disconnect')
      return Object.assign({}, state, { finished: true })
    }

    if (msg.status === undefined) 
      return Object.assign({}, state, {
        image: this.image,
        tag: this.tag,
        from: null,
        threads: [],
        digest: null,
        status: null,
        finished: false
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
      let index = state.threads.find(t => t.id === msg.id)
      if (index === -1) {
        return Object.assign({}, state, {
          threads: [
            ...state.threads,
            msg
          ]
        })
      }
      else {
        return Object.assign({}, state, {
          threads: [
            ...state.threads.slice(0, index),
            msg, 
            ...state.threads.slice(index + 1)
          ]
        })
      }
    }

    console.log('--- unexpected message') 
    console.log(msg)
    console.log('--- unexpected message end')
    return state
  }

  connect(callback) {
    this.agent.connect(callback)
  }
}

export default dockerImageCreator

/**
dockerImageCreator
  .create('httpd', 'latest', (state) => {
    console.log(state)  
  })
**/

