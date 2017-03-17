import validator from 'validator'

const isUUID = uuid => typeof uuid === 'string' && validator.isUUID(uuid)
const isSHA256 = hash => /[a-f0-9]{64}/.test(hash)

export { isUUID, isSHA256 }

