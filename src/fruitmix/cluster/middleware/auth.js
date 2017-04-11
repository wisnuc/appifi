import passport from 'passport'
import bcrypt from 'bcrypt'
import { BasicStrategy } from 'passport-http'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'

// import models from '../models/models'
import { secret } from '../../config/passportJwt'
import { localUsers } from '../model'

const httpBasicVerify = (userUUID, password, done) => {

  localUsers((err, users) => {
    if (err) return done(err)

    let user = users.find(user => user.uuid === userUUID)
    if (!user) return done(new Error('user not found'))

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return done(err) 
      match ? done(null, user) : done(null, false) 
    })
  })
}

const jwtOpts = {
  secretOrKey: secret,
  jwtFromRequest: ExtractJwt.fromAuthHeader()
}

const jwtVerify = (jwt_payload, done) => {
  console.log(123456)
  localUsers((e, users) => {
    if(e) return done(e)
    let user = users.find(u => u.uuid === jwt_payload.uuid)
    user ? done(null, user) : done(null, false)
  })
}

passport.use(new BasicStrategy(httpBasicVerify))
passport.use(new JwtStrategy(jwtOpts, jwtVerify))

export default {
  init: () => passport.initialize(),
  basic: () => passport.authenticate('basic', { session: false }),
  jwt: () => passport.authenticate('jwt', { session: false })
}

