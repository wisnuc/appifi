const passport = require('passport')
const bcrypt = require('bcrypt')
const BasicStrategy = require('passport-http').BasicStrategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const secret = require('../config/passportJwt')
const getFruit = require('../fruitmix')

/*
passport.use(new BasicStrategy((userUUID, password, done) => {

  let user = User.users.find(user => user.uuid === userUUID)
  if (!user) return done(new Error('user not found'))

  bcrypt.compare(password, user.password, (err, match) => {
    if (err) return done(err) 
    match ? done(null, user) : done(null, false) 
  })
}))
*/

let EFruitUnavail = new Error('fruitmix unavailable')

// passport.use(new BasicStrategy(Fruit.verifyUserPassword.bind(Fruit)))

passport.use(new BasicStrategy((userUUID, password, done) => {
  let fruit = getFruit()
  if (!fruit) return done(EFruitUnavail) 
  fruit.verifyUserPassword(userUUID, password, done)
}))

passport.use(new JwtStrategy({
    secretOrKey: secret,
    jwtFromRequest: ExtractJwt.fromAuthHeader()
  }, 
  (jwt_payload, done) => {

    let fruit = getFruit()
    if (!fruit) return done(EFruitUnavail, false)

    let user = fruit.findUserByUUID(jwt_payload.uuid)    
    user ? done(null, user) : done(null, false)
}))

module.exports = {
  init: () => passport.initialize(),
  basic: () => passport.authenticate('basic', { session: false }),
  jwt: () => passport.authenticate('jwt', { session: false })
}

