import React from 'react'

import Transition from '../utils/transition'
import { Paper, TextField, FlatButton, CircularProgress } from 'material-ui'

const pageStyle = {
  display : 'flex',
  flexDirection: 'column',
  alignItems : 'center',
  justifyContent : 'center',
  minHeight : '100vh',
  minWidth : '100vw',
//      backgroundImage : 'url(images/party_orig.jpg)',
//      backgroundSize : 'cover'
}

const paperStyle = {
  display : 'flex',
  flexDirection : 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 120,
  width: 300,
  padding: 10
}

class Login extends React.Component {

  submit() {
    window.store.dispatch({
      type: "LOGIN"
    })
    
    setTimeout(() => {
      window.store.dispatch({
        type: 'LOGIN_SUCCESS'
      })
    }, 1000)
  }

  render() {

    let err, state = window.store.getState().login.state

    switch (state) {
      
      case 'REJECTED':
        err = 'Incorrect password'
        break

      case 'TIMEOUT':
        err = 'Server timeout'
        break

      case 'ERROR':
        err = 'Server internal error, please retry'
        break

      case 'READY':
      case 'BUSY':
      default:
        err = null
        break
    }

    let busy = (state === 'BUSY')

    return (
      <div style={pageStyle}>
        <Transition opts={['login-title', true, true, true, 350, 1000, 1000]}>
          <div style={{height:"64px", opacity:0.54}}>
            <h1>你好，主人</h1>
            <h1>かしこまりました、ご主人様</h1>
            <h1>Yes, My Lord?</h1>
          </div>
        </Transition>
        <Transition opts={['login-dialog', true, true, true, 350, 1000, 1000]}>
          <Paper style={paperStyle} zDepth={1}>
            { busy && <CircularProgress /> }
            { !busy && <TextField  stype={{marginBottom: 10}} hintText="password" type="password" fullWidth={true} errorText={err} />}
            { !busy && <FlatButton style={{marginTop: 10}} label='UNLOCK ME' onTouchTap={this.submit} />}
          </Paper>
        </Transition>
      </div>
    )
  }
}

export default Login

