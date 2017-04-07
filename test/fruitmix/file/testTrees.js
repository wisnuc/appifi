// structure of trees
// n1, n9, n10, n11 are drives
// n1 and n9 are private drives, n10 and n11 are public drives
// owner of n1 is userUUID, owner of n9 is aliceUUID
// n10's readerSet: {userUUID, bobUUID}, shareAllowed is false
// n11's readerSet: {aliceUUID, bobUUID}, shareAllowed is true

/**
 * n1   
 *   n2
 *     n3
 *       n4
 *   n5
 *   n6
 *     n7
 *       n8
 * n9
 * n10
 * n11
 */



import EventEmitter from 'events'

const uuids = {
  'userUUID': 'c9f1d82e-5d88-46d7-ad43-24d51b1b6628',
  'aliceUUID': 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c',
  'bobUUID': 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777',
  'charlieUUID': 'e5f23cb9-1852-475d-937d-162d2554e22c',
  'remoteUUID': 'b8ff0e08-0acb-4013-8129-a4d913e79339',
  'uuid1': '1ec6533f-fab8-4fad-8e76-adc76f80aa2f',
  'uuid2': '278a60cf-2ba3-4eab-8641-e9a837c12950',
  'uuid3': '3772dd7e-7a4c-461a-9a7e-79310678613a',
  'uuid4': '4ba43b18-326a-4011-90ce-ec78afca9c43',
  'uuid5': '5da92303-33a1-4f79-8d8f-a7b6becde6c3',
  'uuid6': '6e702f92-6073-4c11-a406-0a4776212d14',
  'uuid7': '75b5dac2-591a-4c63-8e5e-a955ce51b576',
  'uuid8': '8359f954-ade1-43e1-918e-8ca9d2dc81a0',
  'uuid9': '97e352f8-5535-473d-9dac-8706ffb79abb',
  'uuid10': '016ca193-af05-467e-bbfa-844859bd7f9e',
  'uuid11': 'a8eec3c8-70e5-411b-90fd-ee3e181254b9'
}


class Model extends EventEmitter {
  constructor() {
    super()
  }

  getUsers() {
    return [ {uuid: uuids.userUUID, type: 'local'},
             {uuid: 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c', type: 'local'},
             {uuid: 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777', type: 'local'},
             {uuid: 'e5f23cb9-1852-475d-937d-162d2554e22c', type: 'local'},
             {uuid: 'b8ff0e08-0acb-4013-8129-a4d913e79339', type: 'remote'}
           ]
  }
}

let model = new Model()

const createTestTrees = async (model, fileData) => {
  let n1, n2, n3, n4, n5, n6, n7, n8
   model.emit('drivesCreated', [ {uuid: uuids.uuid1, type: 'private',owner: uuids.userUUID}, 
                                 {uuid: uuids.uuid9, type: 'private', owner: uuids.aliceUUID},
                                 {uuid: uuids.uuid10, type: 'public', writelist: [uuids.userUUID], readlist: [uuids.bobUUID], shareAllowed: false},
                                 {uuid: uuids.uuid11, type: 'public', writelist: [uuids.aliceUUID], readlist: [uuids.bobUUID], shareAllowed: true}
                               ])
    await Promise.delay(200)

    // drive node
    n1 = fileData.root.children[0]
    // n9 = fileData.root.children[1]

    fileData.createNode(n1, {type: 'directory', uuid: uuids.uuid2, name: 'n2'})
    await Promise.delay(100)
    n2 = fileData.uuidMap.get(uuids.uuid2)
    // console.log(n2.parent.name)
    fileData.createNode(n2, {type: 'directory', uuid: uuids.uuid3, name: 'n3'})
    await Promise.delay(100)
    n3 = fileData.uuidMap.get(uuids.uuid3)
    // console.log(n3.parent.name)
    fileData.createNode(n3, {type: 'directory', uuid: uuids.uuid4, name: 'n4'})
    await Promise.delay(100)
    n4 = fileData.uuidMap.get(uuids.uuid4)
    // console.log(n4.parent.name)
    fileData.createNode(n1, {type: 'directory', uuid: uuids.uuid5, name: 'n5'})
    await Promise.delay(100)
    n5 = fileData.uuidMap.get(uuids.uuid5)
    // console.log(n5.parent.name)
    fileData.createNode(n1, {type: 'directory', uuid: uuids.uuid6, name: 'n6'})
    await Promise.delay(100)
    n6 = fileData.uuidMap.get(uuids.uuid6)
    // console.log(n6.parent.name)
    fileData.createNode(n6, {type: 'directory', uuid: uuids.uuid7, name: 'n7'})
    await Promise.delay(100)
    n7 = fileData.uuidMap.get(uuids.uuid7)
    // console.log(n7.parent.name)
    fileData.createNode(n7, {type: 'directory', uuid: uuids.uuid8, name: 'n8'})
    await Promise.delay(100)
    n8 = fileData.uuidMap.get(uuids.uuid8)
}

module.exports = {
  uuids,
  model,
  createTestTrees,
}













