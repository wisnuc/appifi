
const argv = key => process.argv.find((item, index, array) => array[index - 1] === '--' + key)

// parse config from argv
const config = ['path'].reduce((acc, k) => Object.assign(acc, { [k]: argv(k) }), {})

console.log(config)

export default config

