const xxhash = require('xxhash')
const hashpad = Buffer.alloc(4)

const createIBF = (exponent, length, k, seed) => {

  let n = Math.pow(2, exponent)
  let B = []
  let hashPad = Buffer.alloc(4)
  
  for (let i = 0; i < n; i++)
    B.push({
      idSum: Buffer.alloc(length),
      hashSum: Buffer.alloc(4),
      count: 0
    })

  return { n, length, k, seed, B }
}

const hashToDistinctIndices = (id, k, n, seed) => {

  let indices = []
  let s = seed, idx
  while (indices.length < k) {
    s = xxhash.hash(id, s)
    idx = s % n 
    if (!indices.find(i => i === idx)) indices.push(idx)
  }
  return indices
}

const IBFUnion = (ibf, id, insert) => {

  let m, { n, length, k, seed, B } = ibf 

  let indices = hashToDistinctIndices(id, k, n, seed) 
  indices.forEach(j => {

    // B[j].idSum = B[j].idSum (+) id
    for (m = 0; m < length; m++) 
      B[j].idSum[m] ^= id[m]

    // B[j].hashSum = B[j].hashSum (+) Hc(id)
    xxhash.hash(id, seed, hashpad)
    for (m = 0; m < 4; m++)
      B[j].hashSum[m] ^= hashpad[m]

    insert ? B[j].count += 1 : B[j].count -= 1
  })
}

const IBFInsert = (ibf, id) => IBFUnion(ibf, id, true)

const IBFRemove = (ibf, id) => IBFUnion(ibf, id, false)

const IBFEncode = (ibf, ids) => ids.forEach(id => IBFInsert(ibf, id))

const IBFSubtract = (ibf1, ibf2) => {

  let ibf = createIBF(Math.log2(ibf1.n), ibf1.length, ibf1.k, ibf1.seed)
  
  let { n, length, B } = ibf
  let B1 = ibf1.B, B2 = ibf2.B
  let m

  for (let i = 0; i < n; i++) {

    for (m = 0; m < length; m++)
      B[i].idSum[m] = B1[i].idSum[m] ^ B2[i].idSum[m] 

    for (m = 0; m < 4; m++)
      B[i].hashSum[m] = B1[i].hashSum[m] ^ B2[i].hashSum[m]

    B[i].count = B1[i].count - B2[i].count
  }

  return ibf
}

const isPure = (u, seed) => {

  let { idSum, hashSum, count } = u

  if (count === 1 || count === -1) {
    xxhash.hash(idSum, seed, hashpad) 
    if (hashpad.equals(hashSum)) 
      return true
  }
  return false
}

const isZero = (ibf) => {

  let i, m, { n, length, B } = ibf
  for (i = 0; i < n; i++) {
    for (m = 0; m < length; m++) 
      if (B[i].idSum[m] !== 0) return false
    for (m = 0; m < 4; m++) 
      if (B[i].hashSum[m] !== 0) return false
    if (B[i].count !== 0) return false
  } 

  return true
}

const IBFDecode = (ibf) => {

  let { n, length, k, seed, B } = ibf
  let pureList = []
  let DAB = [], DBA = []
  let m

  for (let i = 0; i < n; i++) {
    if (isPure(B[i], seed))
      pureList.push(i)
  }

  while (pureList.length) {

    let i = pureList.shift()
    if (!isPure(B[i], seed))
      continue

    // keep a copy !
    let id = Buffer.from(B[i].idSum)
    let hash = Buffer.from(B[i].hashSum)
    let c = B[i].count

    c > 0 ? DAB.push(id) : DBA.push(id)

    let indices = hashToDistinctIndices(id, k, n, seed)

    indices.forEach(j => {
     
      for (m = 0; m < length; m++)
        B[j].idSum[m] ^= id[m]

      xxhash.hash(id, seed, hashpad)
      for (m = 0; m < 4; m++)
        B[j].hashSum[m] ^= hash[m]

      B[j].count -= c

      if (isPure(B[j], seed)) 
        pureList.push(j)
    })    
  }

  ibf.decode = {
    positive: DAB,
    negative: DBA
  }
  
  return isZero(ibf) 
}

module.exports = {
  createIBF,
  hashToDistinctIndices,
  IBFUnion,
  IBFInsert,
  IBFRemove,
  IBFEncode,
  IBFDecode,
  IBFSubtract,
  isZero
}


