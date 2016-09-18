import path from 'path'

import { expect } from 'chai'

import UUID from 'node-uuid'
import { UINT32 } from 'cuint'
import XXH from 'xxhashjs'

import xxhash from 'xxhash'

import {
  createIBF,
  hashToDistinctIndices,
  IBFInsert,
  IBFRemove,
  IBFEncode,
  IBFSubtract,
  IBFDecode,
  isZero 
} from 'src/fruitmix/algo/iblt'


let uuid0 = "fbc29e8b-b47c-4afd-927a-51322f369eb2"
let uuid1 = "5bbf8f3c-1dfb-49ee-ba90-4c8898d6b303"
let uuid2 = "71e9facd-0342-49e9-ae3a-8b3992efb9f3"
let uuid3 = "f101d691-767d-420c-ae1b-7f5688facbb8"
let uuid4 = "46a13cf5-b756-429f-b691-d347e241b063"
let uuid5 = "e89bf6c4-e9a1-49c2-98a6-e7872be24d51"
let uuid6 = "9523acc4-e3e1-4d1b-a222-f53330a95773"
let uuid7 = "7418f17f-c7b4-4321-8d09-5474499f7ff5"
let uuid8 = "0a54e78c-3093-498a-b728-466a49c1e091"
let uuid9 = "bf3b7147-0d47-4fcc-b008-a53a79fa2288"



describe('demo', function() {
  
  it('nodejs buffer is also an instance of Uint8Array', function() {
    let b = new Buffer(12)
    expect(b instanceof Uint8Array).to.be.true
  })

  it('a packed uuid string can be converted to 16-byte buffer', function() {
    let u = uuid0.replace(/-/g, '') 
    let b = new Buffer(u, 'hex')
    expect(b.length).to.equal(16)
  })

  it('buffer can be converted back to hex string via toString("hex")', function() {
    let u = uuid1.replace(/-/g, '')
    let b = new Buffer(u, 'hex')
    let r = b.toString('hex')
    expect(r).to.equal(u)
  })

  it('xxhashjs("abcd", 0x01020304).toNumber() generate 3521953717', function() {
    let r = XXH.h32('abcd', 0x01020304).toNumber()
    expect(r).to.equal(3521953717)
  })

  it('xxhash.hash(new Buffer("abcd"), 0x01020304) generate 3521953717', function() {
    let r = xxhash.hash(new Buffer("abcd"), 0x01020304)  
    expect(r).to.equal(3521953717)
  })

  it('xxhash.hash(new Buffer("abcd"), 0x01020304, enc) generate LE UINT32 in buffer', function() {
    let enc = new Buffer(4)
    let r = xxhash.hash(new Buffer("abcd"), 0x01020304, enc) 
    expect(enc.readUInt32LE()).to.equal(3521953717)
  })

  // notice this test, the passed argument is BIG ENDIAN !!!
  // which means if we want to reuse enc buffer as new seed, we must read LE and write BE !!!
  it('xxhash.hash(new Buffer("abcd"), new Buffer("01020304", "hex")) <- BIG ENDIAN !!!', function() {
    let r = xxhash.hash(new Buffer("abcd"), new Buffer("01020304", "hex"))
    expect(r).to.equal(3521953717)
  })


  // fail to use returned enc as new seed, using number insteads (a bit slower)
  it('xxhashjs, xxhash, twice, expect 2847076442', function() {

    let js1 = XXH.h32("abcd", 0x01020304).toNumber()
    let js2 = XXH.h32("abcd", js1).toNumber()

    let buf = new Buffer("abcd")
    let ntv1 = xxhash.hash(buf, 0x01020304)
    let ntv2 = xxhash.hash(buf, ntv1)

    let enc = new Buffer(4)
    let enc2 = new Buffer(4)
    xxhash.hash(buf, 0x01020304, enc)

    expect(enc.equals(new Buffer('b5bfecd1', 'hex'))).to.be.true

    xxhash.hash(buf, enc.readUInt32LE(), enc)
    expect(enc.readUInt32LE()).to.equal(2847076642)
  })
})

describe('test IBF', function() {

  let ids = []
  before(function() {
    ids.push(new Buffer('01020304', 'hex'))
    ids.push(new Buffer('01020305', 'hex'))
    ids.push(new Buffer('01020306', 'hex'))
  }) 

  it('should create new IBF, insert then remove, get empty ibf', function() {
    let ibf = createIBF(4, 4, 2, 0xABCD)
    ids.forEach(id => IBFInsert(ibf, id))
    expect(isZero(ibf)).to.be.false
    ids.forEach(id => IBFRemove(ibf, id))
    expect(isZero(ibf)).to.be.true
  })

  it('should subtract and decode 1 positive diff', function() {
    let ibf1 = createIBF(4, 4, 2, 0xABCD)
    let ibf2 = createIBF(4, 4, 2, 0xABCD)

    IBFInsert(ibf1, ids[0])
    IBFInsert(ibf1, ids[1])
    IBFInsert(ibf1, ids[2])

    IBFInsert(ibf2, ids[0])
    IBFInsert(ibf2, ids[1])

    let ibf = IBFSubtract(ibf1, ibf2)
    let r = IBFDecode(ibf)
    expect(r).to.be.true
    expect(ibf.decode.positive[0].equals(ids[2])).to.be.true
    expect(ibf.decode.negative.length).to.equal(0)
  }) 
})

describe('test 1 million IBFInsert perf', function() {
  let m = 1000000
  let ids = [], ibf

  before(function() {
    this.timeout(0)
    for (let i = 0; i < m; i++) {
      let id = Buffer.from(UUID.v4().replace(/-/g, ''), 'hex')
      ids.push(id)
    }

    ibf = createIBF(10, 16, 4, 0xABCD) 
  })

  it('1 million IBFInsert (k=4)', function() {
    this.timeout(0)
    ids.forEach(id => IBFInsert(ibf, id))
  })
})

/**
describe('test uuid fill buffer perf', function() {

  let million = 1000000
  let keys = []
  let hexKeys = []
  let uint8array = []
  before(function() {
    this.timeout(0)
    for (let i = 0; i < million; i++) {
      let uuid = UUID.v4().replace(/-/g, '')
      keys.push(uuid)
      let hex = new Buffer(16).fill(uuid, 'hex')
      hexKeys.push(hex)
      let uint8 = new Uint8Array(16)
      for (let i = 0; i < 16; i++)
        uint8[i] = hex.readUInt8(i)
      uint8array.push(uint8)
    } 
  })

  it('fill node buffer and xord one million uuid, using pre-filled node buffer for uuid key', function() {
    this.timeout(0)

    // scratch pad
    // let uuidBuf = new Buffer(16)
    let target = new Buffer(16).fill(0)

    for (let i = 0; i < million; i++) {
      let uuidBuf = hexKeys[i]
      target[0] = target[0] ^ uuidBuf[0]
      target[1] = target[1] ^ uuidBuf[1]
      target[2] = target[2] ^ uuidBuf[2]
      target[3] = target[3] ^ uuidBuf[3]
      target[4] = target[4] ^ uuidBuf[4]
      target[5] = target[5] ^ uuidBuf[5]
      target[6] = target[6] ^ uuidBuf[6]
      target[7] = target[7] ^ uuidBuf[7]
      target[8] = target[8] ^ uuidBuf[8]
      target[9] = target[9] ^ uuidBuf[9]
      target[10] = target[10] ^ uuidBuf[10]
      target[11] = target[11] ^ uuidBuf[11]
      target[12] = target[12] ^ uuidBuf[12]
      target[13] = target[13] ^ uuidBuf[13]
      target[14] = target[14] ^ uuidBuf[14]
      target[15] = target[15] ^ uuidBuf[15]
    }
  })

  it('fill node buffer and xord one million uuid, using pre-filled node buffer for uuid key, not unloop', function() {
    this.timeout(0)

    // scratch pad
    // let uuidBuf = new Buffer(16)
    let target = new Buffer(16).fill(0)

    for (let i = 0; i < million; i++) {
      let uuidBuf = hexKeys[i]
      for (let j = 0; j < 16; j++)
        target[j] = target[j] ^ uuidBuf[j]
    }
  })

  it('fill node buffer and xord one million uuid, using hex string fill buffer each time', function() {
    this.timeout(0)

    // scratch pad
    let uuidBuf = new Buffer(16)
    let target = new Buffer(16).fill(0)

    for (let i = 0; i < million; i++) {
      uuidBuf.fill(keys[i], 'hex')
      target[0] = target[0] ^ uuidBuf[0]
      target[1] = target[1] ^ uuidBuf[1]
      target[2] = target[2] ^ uuidBuf[2]
      target[3] = target[3] ^ uuidBuf[3]
      target[4] = target[4] ^ uuidBuf[4]
      target[5] = target[5] ^ uuidBuf[5]
      target[6] = target[6] ^ uuidBuf[6]
      target[7] = target[7] ^ uuidBuf[7]
      target[8] = target[8] ^ uuidBuf[8]
      target[9] = target[9] ^ uuidBuf[9]
      target[10] = target[10] ^ uuidBuf[10]
      target[11] = target[11] ^ uuidBuf[11]
      target[12] = target[12] ^ uuidBuf[12]
      target[13] = target[13] ^ uuidBuf[13]
      target[14] = target[14] ^ uuidBuf[14]
      target[15] = target[15] ^ uuidBuf[15]
    }
  })

  it('xxhash 1 million, using node buffer for each key, int for seed', function() {
    let seed = 1234
    for (let i = 0; i < million; i++) {
      xxhash.hash(hexKeys[i], seed)
    }
  })

  it('xxhash 1 million, using uint8array for each key, int for seed', function() {
    let seed = 1234
    for (let i = 0; i < million; i++) {
      xxhash.hash(uint8array[i], seed)
    }
  })

  it('xxhash 1 milling using node buffer for each key, node buffer for seed (should be fastest)', function() {
    let seed = new Buffer(4)
    seed.writeUInt32LE(1234, 0)
    for (let i = 0; i < million; i++) {
      xxhash.hash(hexKeys[i], seed, seed)
    }
  })

  it('xxhashjs 1 million', function() {
    this.timeout(0)
    for (let i = 0; i < million; i++)
      XXH.h32(keys[i], 1234)
  })

})

describe('test INSERT perf', function() {

  let keys = [], B
  before(function() {

    this.timeout(0)

    for (let i = 0; i < 1000000; i++) {
      let keyuuid = UUID.v4().replace(/-/g, '')
      keys.push(new Buffer(keyuuid + keyuuid + keyuuid + keyuuid, 'hex')) 
    }

    B = new XXIBLT(14, 64, 4, 12345)
  }) 

  it('INSERT 1M uuid key value pair', function() {
    this.timeout(0)
    B.ENCODE(keys)
    console.log(B)
  })  
})

**/

describe('test buffer allocate', function() {

  it('allocate 1 million buffer from hex', function() {
    let u = uuid1.replace(/-/g, '')
    let b
    for (let i = 0; i < 1000000; i++)
      b = new Buffer(u, 'hex')
  })

  it('allocate 1 million uint32array from hex', function() {

    this.timeout(0)
    let u = uuid1.replace(/-/g, '')

    let b, count = 0
    for (let i = 0; i < 1000000; i++) {
      b = new Uint8Array(16)
    }
  })
})

