const request = require('superagent')

let a = {
    name: 'alonzo_church.jpg',
    path: 'testdata/alonzo_church.jpg',
    size: 39499, 
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'
}

let obj = {
    comment: 'hello',
    type: 'list',
    list: [{
        size: a.size,
        sha256: a.hash, 
        filename:a.filename
    }]
  }

    request
    .post(`http://127.0.0.1:3000/boxes/3df02a8f-8618-48b6-9ce9-dbb94e4b4011/tweets`)
    .set('Authorization', 'JWT ' + 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnbG9iYWwiOnsiaWQiOiI5ZjkzZGI0My0wMmU2LTRiMjYtOGZhZS03ZDZmNTFkYTEyYWIifSwiZGVhZGxpbmUiOjE1MTc4Mjk4OTQ2OTl9.2ZzCq7gz0357iXQsVzC8_AirIAeVpPR8H2FF5ybUsbU')
    .field('list', JSON.stringify(obj))
    .attach('alonzo.jpg', 'testdata/alonzo_church.jpg', JSON.stringify({size: a.size, sha256: a.hash}))
    .end((err, res) => {
        console.log(err)
        console.log(res)
    })

    /*
    async updateBoxAsync (user, boxUUID, props) {
    // let u = this.findUserByUUID(user.uuid)
    // if (!u || user.global.id !== u.global.id) { throw Object.assign(new Error('no permission'), { status: 403 }) }
    

    let box = this.boxData.getBox(boxUUID)
    if (!box) throw Object.assign(new Error('box not found'), { status: 404 })
    if(!user || !user.global || !user.global.id) throw Object.assign(new Error('no permission'), { status: 403 })
    if(!box.doc.users.includes(user.global.id)) throw Object.assign(new Error('no permission'), { status: 403 })
    
    let isOwner = box.doc.owner === user.global.id
    let isLocalUser = !!this.findUserByGUID(user.global.id)
    // if (box.doc.owner !== user.global.id) { throw Object.assign(new Error('no permission'), { status: 403 }) }

    validateProps(props, [], ['name', 'users', 'mtime'])

    if (props.name) {
      if(!isOwner || !isLocalUser) throw Object.assign(new Error('no permission'), { status: 403 })
      assert(typeof props.name === 'string', 'name should be a string')
    }
    if (props.users) {
      assert(typeof props.users === 'object', 'users should be an object')
      assert(props.users.op === 'add' || props.users.op === 'delete', 'operation should be add or delete')
      assert(Array.isArray(props.users.value), 'value should be an array')
      if(!isOwner && (props.user.op === 'add' || props.value.length > 1 ||props.value[0] !== user.global.id))
        throw Object.assign(new Error('no permission'), { status: 403 })
    }

    return this.boxData.updateBoxAsync(props, boxUUID)
  },
   */