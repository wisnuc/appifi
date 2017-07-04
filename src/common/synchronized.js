class Synchronized {
  constructor () {
    this.pending = []
    this.working = []
  }

  finish (err, data) {
    this.working.forEach(cb => cb(err, data))
    this.working = []

    if (this.pending.length) {
      this.working = this.pending
      this.pending = []
      this.run()
    }
  }

  run () {
    throw new Error('subclass must implement this method')
  }

  request (callback = () => {}) {

    if (this.working.length === 0) {
      this.working = [callback]
      this.run()
    } else {
      this.pending.push(callback)
    }
  }

  async requestAsync () {
    return new Promise((resolve, reject) => {
      this.request((err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}

module.exports = Synchronized

