export const throwError = (text) => { throw new Error(text) }

export const throwInvalid = (text) => {
  let e = new Error(text || 'invalid')
  e.code = 'EINVAL'
  throw e
}

export const throwBusy = (text) => { 
  let e = new Error(text || 'busy')
  e.code = 'EBUSY'
  throw e
}

export const throwOutOfSync = (text) => {
  let e = new Error(text || 'out of sync')
  e.code = 'EOUTOFSYNC'
  throw e
}

