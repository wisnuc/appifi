
/**
hash -> metadata
*/
const map = new Map()

const registerFile = (fingerprint, uuid, filePath) => {
  if (map.has(fingerprint)) return

  // retrieve xstat ???
  // retrieve  
  //
}

const registerBlob = (fingerprint, filePath) => {
  if (map.has(fingerprint)) return
  
  // retrieve file type, if not interested type return
  // retrieve metadata and update map
}

const metadata = fingerprint => map.get(fingerprint) 

module.exports = { registerFile, registerBlob, metadata }

