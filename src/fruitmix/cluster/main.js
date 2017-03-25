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

const bootAsync = async () => {

  const model = Model(froot)
  await model.loadAsync() 

  const docstore = DocumentStore(froot)

  const file = File(froot)
  const fileShare = FileShare(froot, docstore)
  const mediaShare = MediaShare(froot, docstore)

  const media = Media(froot,  
}

export default () => {
  const ipc = config.ipc
  ipc.register('ipctest', (text, callback) => process.nextTick(() => callback(null, text.toUpperCase())))
}

