import passport from 'passport'
import { BasicStrategy } from 'passport-http'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'

// import models from '../models/models'
import { secret } from '../../config/passportJwt'
import { localUsers } from '../models'

const httpBasicVerify = (userUUID, password, done) => {

  localUsers((err, users) => {
    if (err) return done(err)

    let user = users.find(user.uuid === userUUID)
    if (!err) return done(new Error('user not found'))

    bcrypt.compare(password, user.password, (err, match) => {

      if (err) return done(err) 
      match ? callback(null, user) : callback(null, false) 
    })
  })
}

const jwtOpts = {
  secretOrKey: secret,
  jwtFromRequest: ExtractJwt.fromAuthHeader()
}

const jwtVerify = (jwt_payload, done) => {
  let User = models.getModel('user')    
  let user = User.collection.list.find(u => u.uuid === jwt_payload.uuid)
  user ? done(null, user) : done(null, false)
}

passport.use(new BasicStrategy(httpBasicVerify))
passport.use(new JwtStrategy(jwtOpts, jwtVerify))

export default {
  init: () => passport.initialize(),
  basic: () => passport.authenticate('basic', { session: false }),
  jwt: () => passport.authenticate('jwt', { session: false })
}

