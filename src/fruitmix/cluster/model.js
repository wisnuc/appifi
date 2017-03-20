import config from './config'

const localUsersAsync = async () => {

  let froot = config.path
  if (!path.isAbsolute(froot)) throw new Error('not absolute path') // TODO

  let mpath = path.join(froot, 'models', 'models.json')
  let model = JSON.parse(await fs.readFileAsync(mpath))
  let users = model.users      

  return users.filter(u => u.type === 'local')
}

export default model

