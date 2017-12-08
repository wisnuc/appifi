# Linux Platform
+ Enter the project<p>
`cd fruitmix`<p>

+ Install essential libs<p>
 - Method 1: Don't use package.json<p>
 `npm install --save bcrypt body-parser debug nodemon  express jwt-simple mongoose morgan node-uuid passport passport-http passport-jwt serve-favicon validator`<p>
 `npm install --save-dev mocha chai sinon supertest`<p>
 - Method 2: use package.json<p>
 `npm install`<p>

+ Run server<p>
`npm run start`<p>
`npm run test-server`<p>
`npm run unit`<p>
`npm run agent`<p>
`npm run production`<p>

### Done

# Windows Platform
+ Launch cmd tools under "Windows 7"<p>
`"Start" -> "Visual Studio 2013" -> "Visual Studio Tools" -> "Developer Command Prompt for VS2013"`<p>

+ Go into specified directory<p>
`cd c:\path\you\point`<p>

+ Download the project<p>
`git clone https://github.com/winsuntech/fruitmix.git`<p>

+ Enter the project<p>
`cd fruitmix`<p>

+ Install essential libs<p>
 - node-gyp<p>
 `npm install -g node-gyp`<p>

 - bcrypt<p>
 `npm install bcrypt --msvs_version=2013`<p>

     ##### Other packages

 - Method 1: Don't use package.json<p>
 `npm install --save body-parser debug nodemon  express jwt-simple mongoose morgan node-uuid passport passport-http passport-jwt serve-favicon validator`<p>
 `npm install --save-dev mocha chai sinon supertest`<p>

 - Method 2: use package.json<p>
 `npm install`<p>

  *PS: Install "fs-xattr" module failed, because of windows dosen't support extended attributes on its filesystems at all.*<p>

### Invalid
