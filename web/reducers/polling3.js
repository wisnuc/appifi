import request from 'superagent'
import { dispatch } from '../utils/utils'

function pollingMachine(url, actionType, period) {

  let status = 0

  // either timeout or req is set, but not both
  let timeout = null
  let req = null

  const get = () => {

    timeout = null
    req = request
      .get(url)
      .set('Accept', 'application/json')
      .end((err, res) => {

        req = null
        if (err) {
          // schedule another get
          timeout = setTimeout(() => get(), period)
          return
        }
        
        status = res.body.status
        // schedule another getStatus
        timeout = setTimeout(() => getStatus(), period)
        dispatch({
          type: actionType, 
          data: res.body
        })
      })
  }

  const getStatus = () => {

    timeout = null
    req = request
      .get(url + '/status')
      .set('Accept', 'application/json')
      .end((err, res) => {

        req = null
        if (err) {
          // schedule another head
          timeout = setTimeout(() => getStatus(), period)
          return
        }
      
        if (status === res.body.status) {
          // schedule another head
          timeout = setTimeout(() => getStatus(), period)
          return
        }

        timeout = setTimeout(() => get(), 0)
      })  
  }

  const start = () => {

    status = 0 
    timeout = null
    req = null
    get()
  }

  const stop = () => {

    if (timeout) clearTimeout(timeout)
    if (req) req.abort()

    status = 0
    timeout = null
    req = null
  }

  const started = () => {

    return (timeout !== null || req !== null)
  }

  return {start, started, stop}
}

export default pollingMachine

