import React from 'react'

import TextField from 'material-ui/TextField'
import FlatButton from 'material-ui/FlatButton'
import Paper from 'material-ui/Paper';
import CircularProgress from 'material-ui/CircularProgress';


class Login extends React.Component {

  constructor(props) {
    super(props)
  }

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

    const pageStyle = {
      display : 'flex',
      alignItems : 'center',
      justifyContent : 'center',
      minHeight : '100vh',
      minWidth : '100vw',
      backgroundImage : 'url(images/party_orig.jpg)',
      backgroundSize : 'cover'
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
    console.log("state is " + state);

    return (
      <div className="container" style={pageStyle} >
        <Paper style={paperStyle} zDepth={4}>
          { busy && <CircularProgress /> }
          { !busy && <TextField  stype={{marginBottom: 10}} hintText="password" type="password" fullWidth={true} errorText={err} />}
          { !busy && <FlatButton style={{marginTop: 10}} label='UNLOCK' onTouchTap={this.submit} />}
        </Paper>
      </div>
    )
  }
}

export default Login

