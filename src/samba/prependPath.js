import Debug from 'debug'
const PREPEND_PATH = Debug('SAMBA:PREPEND_PATH')

const getPrependPath = () => {

	let indexProcessArgv = null

	if((indexProcessArgv = (process.argv).indexOf('--path')) >= 0) {
		let prependPath = (process.argv)[indexProcessArgv + 1]
    PREPEND_PATH(prependPath)
		return prependPath
	}
	else {
		throw new Error('getPrependPath error: No "--path" Parameters')
	}

}

module.exports = getPrependPath