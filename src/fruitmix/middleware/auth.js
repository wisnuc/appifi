const passport = require('passport')
const bcrypt = require('bcrypt')
const BasicStrategy = require('passport-http').BasicStrategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt

passport.use(new BasicStrategy((userUUID, password, done) => {

  localUsers((err, users) => {
    if (err) return done(err)

    let user = users.find(user => user.uuid === userUUID)
    if (!user) return done(new Error('user not found'))

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return done(err) 
      match ? done(null, user) : done(null, false) 
    })
  })
}))

passport.use(new JwtStrategy({
    secretOrKey:'JsonWebTokenIsAwesome',
    jwtFromRequest: ExtractJwt.fromAuthHeader()
  }, 
  (jwt_payload, done) => {
    localUsers((e, users) => {
      if(e) return done(e)
      let user = users.find(u => u.uuid === jwt_payload.uuid)
      user ? done(null, user) : done(null, false)
    })
}))

module.exports = {
  init: () => passport.initialize(),
  basic: () => passport.authenticate('basic', { session: false }),
  jwt: () => passport.authenticate('jwt', { session: false })
}

