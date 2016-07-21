import React from 'react'
import { RaisedButton, Paper } from 'material-ui'

let getUrl = () => `http://${window.location.hostname}:3001`

export default () => (
    <div key='system-update-content-page'>
      <Paper style={{padding:16, fontSize: 15, opacity:0.87}}>
        <div style={{fontSize:24, marginBottom:16}}>Appifi Bootstrap</div>
        There is a standalone and dedicated program to manage Appifi service, for downloading latest version, installing and uninstalling, as well as starting and stopping Appifi service. 
        <br />
        This maintenance tool is named as Appifi Bootstrap and can be access through port 3001. 
        <br />
        Click the following button to navigate to Appifi Bootstrap.
        <br />
        <br />
        <RaisedButton label='go to appifi bootstrap' primary={true} onTouchTap={() => window.open(getUrl())}/> 
      </Paper>
    </div>
  )

