
/** simply using a JavaScript plain object as key value pairs for singleton models **/

var models = {}

const setModel = (name, model) => models[name] = model
const getModel = (name) => {
  if (models[name] === undefined) throw new Error('model not found')
  return models[name]
}

const list = () => Object.assign({}, models)

const clear = () => models = {}

export default { setModel, getModel, list, clear }

