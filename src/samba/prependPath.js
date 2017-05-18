const getPrependPath = () => {
	let indexProcessArgv = null

	if((indexProcessArgv = (process.argv).indexOf('--path')) >= 0) {
		let prependPath = (process.argv)[indexProcessArgv + 1]
		return prependPath
	}
	else {
		throw new Error('getPrependPath error: No "--path" Parameters')
	}
}

module.exports = getPrependPath