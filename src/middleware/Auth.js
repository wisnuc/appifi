const passport = require('passport')
const bcrypt = require('bcrypt')
const BasicStrategy = require('passport-http').BasicStrategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const jwt = require('jwt-simple')

/**
Auth is an authentication middleware for node/express.

The popular passport module for node/express is mostly used as singleton. This is inconvenient for testing. Instead, this class encapsulates pp as instance of class object.

An Auth object requires a user list and a secret string to work. The user list can be provided during object construction or updated later. The Auth object has no knowledge of whether the admin is specially treated (such as in N2) or not. It just uses the provided user list to work.

@class
*/
class Auth {

  /**
  Create an Auth middleware
  @param {string} secret - secret string for JWT token
  @param {object[]|function} users - a user list or a function evaluates to a user list
  */
  constructor (secret, users = []) {
    this._users = users
    Object.defineProperty(this, 'users', {
      get () {
        let value = typeof this._users === 'function'
          ? this._users()
          : this._users

        return Array.isArray(value) ? value : []
      }
    })

    // this.users = users
    this.secret = secret

    let jwtOpts = {
      secretOrKey: this.secret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt')
    }

    // this is not officially documented
    // see https://github.com/jaredhanson/passport/issues/27
    this.pp = new passport.Passport()
    this.pp.use(new BasicStrategy(this.handleBasicAuth.bind(this)))
    this.pp.use(new JwtStrategy(jwtOpts, this.handleJwtAuth.bind(this)))
    this.middleware = this.pp.initialize()
  }

  /**
  Authenticate user via http basic authentication. Callback for BasicStrategy.

  @param {string} userUUID
  @param {string} password
  @param {function} done - `(err, user|false, info) => {}` callback
  */
  handleBasicAuth (userUUID, password, done) {
    if (this.users.length === 0) {
      done(null, false, { message: 'not available' })
    } else {
      let user = this.users.find(u => u.uuid === userUUID)
      if (!user) {
        done(null, false, { message: 'user not found' })
      } else if (user.disabled) {
        done(null, false, { message: 'user disabled' })
      } else {
        bcrypt.compare(password, user.password, (err, match) => {
          if (err) {
            done(err)
          } else if (match) {
            done(null, this.strip(user))
          } else {
            done(null, false, { message: 'incorrect password' })
          }
        })
      }
    }
  }

  /**
  Authenticate user via JWT token. Callback for JwtStrategy.

  @param {object} payload - jwt token payload
  @param {function} done - `(err, user|false, info) => {}` callback
  */
  handleJwtAuth (payload, done) {
    if (this.users.length === 0) {
      done(null, false, { message: 'not available' })
    } else {
      let user = this.users.find(u => u.uuid === payload.uuid)
      if (!user) {
        done(null, false, { message: 'user not found' })
      } else if (user.disabled) {
        done(null, false, { message: 'user disabled' })
      } else {
        done(null, this.strip(user))
      }
    }
  }

  /**
  */
  strip (user) {
    // TODO
    return {
      uuid: user.uuid,
      username: user.username,
      isFirstUser: user.isFirstUser,
      phicommUserId: user.phicommUserId
    }
  }

  /**
  Update user list
  */
  setUsers (users) {
    this.users = users
  }

  /**
  A higher-order function returning a express router that authenticates request via http basic authentication

  `passport-http` does NOT handle info correctly. So the custom callback version won't work.

  http://www.passportjs.org/docs/authenticate/
  */
  basic () {
    /* useless, passport http does not support info
    return (req, res, next) => {
      this.pp.authenticate('basic', { session: false }, (err, user, info1, info2) => {
        if (err) return next(err)

        console.log('user ----', err, user, info1, typeof info1, info2, typeof info2)

        if (!user) {
          res.status(401).json({})

          console.log(new Error())
        } else {
          req.logIn(user, err => err ? next(err) : next())
        }
      })(req, res, next)
    }
    **/

    return this.pp.authenticate('basic', { session: false })
  }

  /**
  Authenticate request via JWT token
  */
  jwt () {
    return this.pp.authenticate('jwt', { session: false })
  }

  /**
  Generate jwt token for given user
  */
  token (user) {
    return {
      type: 'JWT',
      token: jwt.encode({
        uuid: user.uuid
      }, this.secret)
    }
  }

}

module.exports = Auth
