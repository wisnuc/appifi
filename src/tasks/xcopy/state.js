/**
abstract base class of state
@memberof XCopy
*/
class State {

  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)

    this.ctx.emit(this.getState())
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

  view () {
    return null
  }
}

module.exports = State


