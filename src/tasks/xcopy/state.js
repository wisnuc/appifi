class State {

  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  destroy () {
    this.exit()
  }

  getState () {
    return this.constructor.name
  }

  setState (state, ...args) {
    this.exit()
    let NextState = this.ctx[state]
    new NextState(this.ctx, ...args)
  }

  enter () {
  }

  exit () {
  }
}

module.exports = State


