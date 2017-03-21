import config from './config'

// this is the module start fruitmix core

/**

const model = 
const fileData = 
const fileShare =
const fileService =
const docstore = 
const mediaShareData = 
const mediaShareService = 
const mediaData = 

**/

const froot = config.path


export default () => {

  const ipc = config.ipc
  ipc.register('ipctest', (text, callback) => process.nextTick(() => callback(null, text.toUpperCase())))
}

