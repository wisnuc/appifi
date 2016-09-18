import { expect } from 'chai'
import magicMeta from 'src/fruitmix/lib/magicMeta'

describe('test magic meta for a JPEG with exif (uppercase Standard)', function() {
  it('should parse a magic from a JPEG image from a SONY phone (xperia xa)', function() {
    let magic = 'JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, Exif Standard: [TIFF image data, little-endian, direntries=18, description=, manufacturer=Sony, model=F3116, orientation=upper-right, xresolution=326, yresolution=334, resolutionunit=2, software=MediaTek Camera Application, datetime=2016:07:19 15:44:47], baseline, precision 8, 4096x2304, frames 3'

    let meta = magicMeta(magic)
    expect(meta.type).to.equal('JPEG')
    expect(meta.width).to.equal(4096)
    expect(meta.height).to.equal(2304)
    expect(meta.datetime).to.equal('2016:07:19 15:44:47')
    expect(meta.extended).to.be.true
  })
})

describe('test magic meta for a JPEG with exif (lowercase standard)', function() {
  it('should parse a magic from a JPEG image from a Samsung phone (T705C)', function() {
    let magic = 'JPEG image data, Exif standard: [TIFF image data, little-endian, direntries=12, height=1836, manufacturer=SAMSUNG, model=SM-T705C, orientation=upper-left, xresolution=210, yresolution=218, resolutionunit=2, software=T705CZCU1ANG3, datetime=2014:12:13 15:31:24, width=3264], baseline, precision 8, 3264x1836, frames 3'
  
    let meta = magicMeta(magic)
    expect(meta.type).to.equal('JPEG')
    expect(meta.width).to.equal(3264)
    expect(meta.height).to.equal(1836)
    expect(meta.datetime).to.equal('2014:12:13 15:31:24')
    expect(meta.extended).to.be.true
  })
})

describe('test magic meta for a JPEG w/o exif', function() {
  it('should parse an sample data', function() {
    let magic = 'JPEG image data, JFIF standard 1.01, resolution (DPI), density 72x72, segment length 16, baseline, precision 8, 160x94, frames 3'
  
    let meta = magicMeta(magic)
    expect(meta.type).to.equal('JPEG')
    expect(meta.width).to.equal(160)
    expect(meta.height).to.equal(94)
    expect(meta.datetime).to.be.null
    expect(meta.extended).to.be.false
  })
})


