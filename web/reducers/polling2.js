import request from 'superagent'
import { dispatch } from '../utils/utils'

class Polling {

  constructor(url, actionType, period) {

    this.url = url
    this.actionType = actionType
    this.period = period

    this.status = 0
    this.timeout = 0
    this.req = null
  }

  get(status) {
    this.timeout = 0
    this.req = request.get(this.url + (status ? '/status' : ''))
      .set('Accept', 'application/json')
      .end((err, res) => {
        this.req = null
        if (!err && res.ok && !status) { // requesting_state
          this.status = res.body.status
          dispatch({ type: this.actionType, data: res.body })
          this.timeout = setTimeout(() => this.get(true), this.period)
        } 
        else if (!err && res.ok && status && this.status !== res.body.status) // requesting_status
          this.timeout = setTimeout(() => this.get(false), 0)
        else
          this.timeout = setTimeout(() => this.get(status), this.period)
      })
  }

  start() {
    this.status = 0
    this.timeout = 0
    this.req = null
    this.get(false)
  }

  stop() {
    if (this.timeout) clearTimeout(this.timeout)
    if (this.req) req.abort()

    this.status = 0
    this.timeout = 0
    this.req = null
  }
}

export default (url, actionType, period) => new Polling(url, actionType, period)
