## samba password verification

```js
var crypto = require('crypto')    

const md4Encrypt = (text) =>    
  crypto.createHash('md4')    
    .update(Buffer.from(text, 'utf16le'))    
    .digest('hex')    
    .toUpperCase()    

console.log(md4Encrypt('hello'))
```

copy above code and paste into a .js file, say, `md4.js`, then running

```
node md4.js
```

You can get the encrypted samba password for `hello`.

Change `hello` to other text to calculate the corresponding encrypted password.
