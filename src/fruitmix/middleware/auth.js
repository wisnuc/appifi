const passport = require('passport')
const bcrypt = require('bcrypt')
const BasicStrategy = require('passport-http').BasicStrategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const secret = require('../config/passportJwt')
const User = require('../user/user')

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

passport.use(new BasicStrategy(User.verifyPassword.bind(User)))

passport.use(new JwtStrategy({
    secretOrKey: secret,
    jwtFromRequest: ExtractJwt.fromAuthHeader()
  }, 
  (jwt_payload, done) => {
    let user = User.findUser(jwt_payload.uuid)    
    user ? done(null, user) : done(null, false)
}))

module.exports = {
  init: () => passport.initialize(),
  basic: () => passport.authenticate('basic', { session: false }),
  jwt: () => passport.authenticate('jwt', { session: false })
}

