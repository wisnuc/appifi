const Fruitmix = require('./Fruitmix')
const broadcast = require('./common/broadcast')

let fruitmix = null
let storage = null

broadcast.on('FruitmixStart', (froot, opts) => {
  try {
    fruitmix = new Fruitmix(froot, opts)
    if (storage) fruitmix.setStorage(storage)
    // !!! guarantee to be async
    process.nextTick(() => broadcast.emit('FruitmixStarted'))
  } catch (e) {
    console.log(e)
  }
})

broadcast.on('StorageUpdate', (err, _storage) => {
  if (err) return
  if (storage === _storage) return
  storage = _storage
  if (fruitmix) fruitmix.setStorage(storage)
})

// TODO
broadcast.on('FruitmixStop', () => {
  fruitmix = null
})

module.exports = () => fruitmix

