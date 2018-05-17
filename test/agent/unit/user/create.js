const UUID = require('uuid')
/**
 * @param {array} users
 * @param {object} props
 * {
 *    user: {
 *      uuid: ""
 *    }
 *    data: {
 *      "username": "string", // required
 *      "password": "crypt string", //option
 *      "smbPassword": "crypt string", //option
 *      "phicommUserId": "number string", //required
 *    }
 *    
 * }
 * 
 * @returns {object} 
 * {
 *    response: {
 *      status: 400
 *      data: {}
 *    },
 *    system: {
 *       users: []
 *    }
 * }
 */

let response = (status, data, users) => {
  return {
    response: {
      status,
      data, 
    },
    users
  }
}

let fullInfo = (user) => {
  return {
    uuid: user.uuid,
    username: user.username,
    isFirstUser: user.isFirstUser,
    phicommUserId: user.phicommUserId,
    password: !!user.password,
    smbPassword: !!user.smbPassword
  }
}

let createUserSpecFunc = (users, props) => {
  let admin = users.find(u => u.isFirstUser === true)
  if (!admin) throw new Error('invalid users')
  if (!props || !props.user) throw new Error('invalid props')
  if (props.user.uuid !== admin.uuid) return response(403, {}, users)
  let data = props.data
  if (!data || typeof data !== 'object') return response(400, {}, users)

  let recognized = ['username', 'phicommUserId', 'password', 'smbPassword']
  let required = ['username', 'phicommUserId']
  let dataKeys = Object.getOwnPropertyNames(data)
  dataKeys.forEach((v, index) => {
    let rqIndex = required.indexOf(v)
    if (rqIndex !== -1)
      required = [...required.slice(0, rqIndex), ...required.slice(rqIndex + 1)]
    if (recognized.includes(v))
      dataKeys = [...dataKeys.slice(0, index), ...dataKeys.slice(index + 1)]
  })
  if (dataKeys.length) return response(400, { message: `invaild args: ${ dataKeys.join(', ')}`}, users)
  if (required.length) return response(400, { message: `required args not found: ${ required.join(', ')}`}, users)


  let phicommUserId = data.phicommUserId
  let reg1 = /^[0-9]*$/
  if (!phicommUserId || typeof phicommUserId !== 'string' || !phicommUserId.length || !reg1.test(phicommUserId)) {
    return response(400, { message: 'invalid phicommUserId'}, users)
  }
  let pU = users.find(u => u.phicommUserId === phicommUserId)
  if (pU && pU.status !== 'DELETED') return response(400, { message: 'exist phicommUserId'}, users)
  
  let username = data.username
  if (!username || typeof username !== 'string' || !username.length) {
    return response(400, { messsage: 'invalid username'})
  }
  let nU = users.find(u => u.username === username)
  if (nU && nU.status !== 'DELETED') return response(400, { message: 'exist username'}, users)

  let password = data.password
  let smbPassword = data.smbPassword
  if (password && typeof password !== 'string') return response(400, { message: 'invalid password'}, users)
  if (smbPassword && typeof smbPassword !== 'string') return response(400, { message: 'invalid smbPassword' }, users)

  let newUser = {
    uuid: UUID.v4(),
    username: data.username,
    isFirstUser,
    phicommUserId: data.phicommUserId,
    password: data.password,
    smbPassword: data.smbPassword,
    status: 'ACTIVE'
  }

  return response(200, fullInfo(newUser), [...users, Object.assign({}, newUser)])
}


it('xxxx', done => {
  //a, b
  let data = createUserSpecFunc(a, b)

  request(app).post(xxx)
    .send(b)
    .expect(data.status)
    .end( err
      
    )
})