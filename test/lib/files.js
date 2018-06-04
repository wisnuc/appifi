module.exports = {

  alonzo: {
    name: 'alonzo.jpg',
    path: 'testdata/alonzo.jpg',
    size: 39499, 
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'
  },

  bar: {
    name: 'bar',
    path: 'testdata/bar',
    size: 4,
    hash: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730' 
  },

  empty: {
    name: 'empty',
    path: 'testdata/empty',
    size: 0,
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },

  foo: {
    name: 'foo',
    path: 'testdata/foo',
    size: 4,
    hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c'
  },

  hello: {
    name: 'hello',
    path: 'testdata/hello',
    size: 6,
    hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
  },

  vpai001: {
    name: 'vpai001',
    path: 'testdata/vpai001.jpg',
    size: 4192863,
    hash: '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb', 
  },

  world: {
    name: 'world',
    path: 'testdata/world', 
    size: 6,
    hash: 'e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317'  
  },

  oneByteX: {
    name: 'one-byte-x',
    path: 'test-files/one-byte-x',
    size: 1,
    hash: '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
  },

  halfGiga: {
    name: 'half-giga',
    path: 'test-files/half-giga',
    size: 512 * 1024 * 1024,
    hash: '767c649bbc1535e53afe18d1d9e21828d36262eac19d60cc3035636e9bc3cdbb'
  },

  oneGiga: {
    name: 'one-giga',
    path: 'test-files/one-giga',
    size: 1024 * 1024 * 1024,
    hash: 'a728498b7d120ea93ff32f548df489e7e9feeefd5dab7124c12ee3e49ff84a91' 
  },

  oneGigaMinus1: {
    name: 'one-giga-minus-1',
    path: 'test-files/one-giga-minus-1',
    size: 1024 * 1024 * 1024 - 1,
    hash: 'dfbe42ebd0867f5dc8dc602f035237e88984c93a4e0a7ad7f92f462e326fa6f2'  
  },

  oneGigaPlusX: {
    name: 'one-giga-plus-x',
    path: 'test-files/one-giga-plus-x',
    size: 1024 * 1024 * 1024 + 1,
    hash: '9813e8dea92f5d5d2c422aa5191c29694531f012c13229fa65c90bb5538b0c6b'
  },

  oneAndAHalfGiga: {
    name: 'one-and-a-half-giga',
    path: 'test-files/one-and-a-half-giga',
    size: 1024 * 1024 * (1024 + 512),
    hash: 'd723ceb8be2c0f65b3ba359218553187f409f0bbb2ffd6a8f03464aa7dba46f5'
  },

  twoGiga: {
    name: 'two-giga',
    path: 'test-files/two-giga',
    size: 1024 * 1024 * 1024 * 2,
    hash: 'cf2981f9b932019aaa35122cbecd5cdd66421673d3a640ea2c34601d6c9d3a12'
  },

  twoGigaMinus1: {
    name: 'two-giga-minus-1',
    path: 'test-files/two-giga-minus-1',
    size: 1024 * 1024 * 1024 * 2 - 1,
    hash: '881e4980ed2d54067f5c534513b43f408040a615731c9eb76c06ff4945a3e3ae'
  },
  
  twoGigaPlusX: {
    name: 'two-giga-plus-x',
    path: 'test-files/two-giga-plus-x',
    size: 1024 * 1024 * 1024 * 2 + 1,
    hash: '38a664204a7253ef6f6b66bd8162170115d1661cde6a265c4d81c583ac675203'
  },

  twoAndAHalfGiga: {
    name: 'two-and-a-half-giga',
    path: 'test-files/two-and-a-half-giga',
    size: 1024 * 1024 * 1024 * 2 + 512 * 1024 * 1024,
    hash: 'c4eeea260304c747c4329a10274e7c4256a1bacff6545cada5f03e956f9d2c62' 
  },

  threeGiga: {
    name: 'three-giga',
    path: 'test-files/three-giga',
    size: 1024 * 1024 * 1024 * 3,
    hash: '31d98188bf9ad4f30e87dce7da1e44bead3ee2b6aca5b4f1b1be483fdc000f58'  
  },

  threeGigaMinus1: {
    name: 'three-giga-minus-1',
    path: 'test-files/three-giga-minus-1',
    size: 1024 * 1024 * 1024 * 3 - 1,
    hash: 'f34af33573a9710b3376013f3d337ef54813d21ef366f845c4ae105df50b6862' 
  },

  threeGigaPlusX: {
    name: 'three-giga-plus-x',
    path: 'test-files/three-giga-plus-x',
    size: 1024 * 1024 * 1024 * 3 + 1,
    hash: '4f78a807e5b0909a06ce68d58f5dccc581db6bbc51a00bb07148ec599a9d2a32'  
  },

  threeAndAHalfGiga: {
    name: 'three-and-a-half-giga',
    path: 'test-files/three-and-a-half-giga',
    size: 1024 * 1024 * 1024 * 3 + 512 * 1024 * 1024,
    hash: 'a55587006fb9125fd09e7d8534ab6e7e0e9ec47aa02fc6d8495a3bb43d3968bb' 
  },

  fiveGiga: {
    name: 'five-giga',
    path: 'test-files/five-giga',
    size: 5 * 1024 * 1024 * 1024,
    hash: '757deb7202aa7b81656922322320241fc9cc6d8b5bb7ff60bdb823c72e7ca2fd'
  },

  pngHDrgba: {
    name: 'pngHDrgba',
    path: 'testdata/pnggradHDrgba.png',
    size: 22002,
    hash: '99ff0b679081cdca00eb27c5be5fd9428f1a7cf781cc438b937cf8baf8551c4d'
  }
}


