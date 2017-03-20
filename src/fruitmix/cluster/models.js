import path from 'path'
import fs from 'fs'

import config from './config'

const localUsersAsync = async () => {

  let froot = config.path
  if (!path.isAbsolute(froot)) throw new Error('not absolute path') // TODO

  let mpath = path.join(froot, 'models', 'models.json')
  let model = JSON.parse(await fs.readFileAsync(mpath))
  let users = model.users      

  return users.filter(u => u.type === 'local')
}

const localUsers = callback => localUsersAsync().asCallback(callback)

export { localUsers }

