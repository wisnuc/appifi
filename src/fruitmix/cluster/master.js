const path = require('path')

import config from './config'
import createModelService from '../models/modelService'
import { createDocumentStoreAsync } from '../lib/documentStore'
import FileData from '../file/fileData'

export default async () => {

	const froot = config.path
	const modelService = createModelService(froot)
	const docStore = await createDocumentStoreAsync(froot)
	const fileData = new FileData(path.join(froot, 'drives'), modelService.modelData)	

	await modelService.initializeAsync()

	console.log(modelService.modelData)

	if (process.env.FORK) {
		console.log('fruitmix started in forked mode')	

		process.send({ type: 'fruitmixStarted' })
		process.on('message', message => {
			switch (message.type) {
			case 'createFirstUser':
				break
			default:
				break	
			}
		})
	}
	else {
		console.log('fruitmix started in standalone mode')
	}

  const ipc = config.ipc
  ipc.register('ipctest', (text, callback) => process.nextTick(() => callback(null, text.toUpperCase())))
}

