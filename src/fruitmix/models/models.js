import Debug from 'debug'

const debug = Debug('fruitmix:model')

/** simply using a JavaScript plain object as key value pairs for singleton models **/

var models = {}

const setModel = (name, model) => {
  debug(`set model ${name}`)
  models[name] = model
}

const getModel = (name) => {
  if (models[name] === undefined) throw new Error(`model ${name} not found`)
  return models[name]
}

const list = () => Object.assign({}, models)

const clear = () => models = {}

export default { setModel, getModel, list, clear }

