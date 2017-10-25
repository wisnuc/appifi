import path from 'path'

const argv = key => 
  process.argv.find((item, index, array) => 
    array[index - 1] === '--' + key)

const config = ['path'].reduce((acc, c) => 
  Object.assign(acc, { [c] : argv(c) }), {})

export default config

