import path from 'path'

import chai from 'chai'
const expect = chai.expect

import { rimrafAsync, mkdirpAsync, fs } from 'src/fruitmix/util/async'

import paths from 'src/fruitmix/lib/paths'

import { createMediaTalkStore } from 'src/fruitmix/lib/mediaTalkStore.js'
import { createMediaTalk } from 'src/fruitmix/lib/mediaTalk.js' 

const tmptest = path.join(process.cwd(), 'tmptest')

describe(path.basename(__filename), function() {

  let docstore, tstore

  beforeEach(() => (async () => {

    await rimrafAsync(tmptest)  
    await paths.setRootAsync(tmptest)
  
    docstore = await Promise.promisify(createDocumentStore)()
    tstore = await Promise.promisify(createMediaTalkStore)(docstore)

  })())

 
  it('should create a mediaTalk', function() {

    
  }) 
})




