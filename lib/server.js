import { store } from 'lib/reducers'

let state = null
let status = 0

store.subscribe(() => {
  status++ 
})

export default {
  status: () => {
    return { status }
  },
  get: () => {
    return Object.assign({},
      store.getState(),
      { status })
  }
}

