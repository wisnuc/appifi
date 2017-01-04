var crypto = require('crypto')

const md4Encrypt = text => 
  crypto.createHash('md4')
    .update(Buffer.from(text, 'utf16le'))
    .digest('hex')
    .toUpperCase()


console.log(md4Encrypt('hello'))
console.log(md4Encrypt(''))

