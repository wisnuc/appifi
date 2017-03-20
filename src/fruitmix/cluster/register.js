import ipcMain from './ipcMain'

const  register = (obj) => {
  for (let prop of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
    let method = obj[prop]
    if (!(method instanceof Function) || method === obj.constructor) continue;
      ipcMain.registerCommandHandler((obj.constructor.name + '_' + method.name).toUpperCase(), method)
  }
}

export { register } 