const Fruitmix = require('./Fruitmix')
const broadcast = require('./common/broadcast')

let fruitmix = null

broadcast.on('FruitmixStart', (froot, opts) => {
  try {
    fruitmix = new Fruitmix(froot, opts)
    // !!! guarantee to be async
    process.nextTick(() => broadcast.emit('FruitmixStarted'))
  } catch (e) {
    console.log(e)
  }
})

// TODO
broadcast.on('FruitmixStop', () => {
  fruitmix = null
})

module.exports = () => fruitmix

