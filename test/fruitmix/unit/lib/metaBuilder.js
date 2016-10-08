import path from 'path'
import EventEmitter from 'events'

import chai from 'chai'

const expect = chai.expect

import { rimrafAsync, mkdirpAsync, fs, xattr } from 'src/fruitmix/util/async'
import { readXstat, updateXattrHashMagic } from 'src/fruitmix/lib/xstat'

import { createMetaBuilder } from 'src/fruitmix/lib/metaBuilder'

const readXstatAsync = Promise.promisify(readXstat)
const updateXattrHashMagicAsync = Promise.promisify(updateXattrHashMagic)

const cwd = process.cwd()

let img001UUID
const img001Hash = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
const img001Magic = 'JPEG image data, Exif standard: [TIFF image data, little-endian, direntries=12, height=1836, manufacturer=SAMSUNG, model=SM-T705C, orientation=upper-left, xresolution=210, yresolution=218, resolutionunit=2, software=T705CZCU1ANG3, datetime=2014:12:13 15:31:24, width=3264], baseline, precision 8, 3264x1836, frames 3'

let img002UUID
const img002Hash = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7'
const img002Magic = 'JPEG image data, Exif standard: [TIFF image data, little-endian, direntries=18, description=, manufacturer=Sony, model=F3116, orientation=upper-left, xresolution=326, yresolution=334, resolutionunit=2, software=MediaTek Camera Application, datetime=2016:07:19 14:56:23]'

let digestObj

class Forest extends EventEmitter {

  constructor() {
    super()
  }

  findDigestObject(digest) {

    switch (digest) {
    case '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be': // img001

      if (digestObj) return digestObj

      digestObj = {
        type: 'JPEG',
        nodes: [
          {
            uuid: img001UUID,
            hash: img001Hash,
            namepath: () => path.join(cwd, 'tmptest', 'img001')
          }
        ]
      }    
      return digestObj

    default:
      break
    }
  }
} 

describe(path.basename(__filename), function() {

  beforeEach(() => (async () => {

    await rimrafAsync('tmptest')
    await mkdirpAsync('tmptest/folder1')

    // create hard link, faster than copy
    await fs.linkAsync('fruitfiles/20141213.jpg', 'tmptest/img001')
    await fs.linkAsync('fruitfiles/20160719.jpg', 'tmptest/img002')

    let xstat

    xstat = await readXstatAsync('tmptest/img001')
    img001UUID = xstat.uuid
    await updateXattrHashMagicAsync('tmptest/img001', 
      xstat.uuid, img001Hash, img001Magic, xstat.mtime.getTime()) 

    xstat = await readXstatAsync('tmptest/img002')
    img002UUID = xstat.uuid
    await updateXattrHashMagicAsync('tmptest/img002',
      xstat.uuid, img002Hash, img002Magic, xstat.mtime.getTime())
    
  })())

  it('should do something', function(done) {

    let mock = new Forest()    
    let builder = createMetaBuilder(mock)    
    
    builder.on('metaBuilderStarted', () => console.log('metaBuilderStarted'))
    builder.on('metaBuilderStopped', () => {
      console.log('metaBuilderStopped')
      console.log(builder) 
      console.log(digestObj)
      expect(digestObj.meta).to.deep.equal({ 
        format: 'JPEG',
        width: 3264,
        height: 1836,
        exifOrientation: 1,
        exifDateTime: '2014:12:13 15:31:24',
        exifMake: 'SAMSUNG',
        exifModel: 'SM-T705C',
        size: 2331588 
      })
      done()
    })
    mock.emit('meta', img001Hash)
  })
})

