import React from 'react'
import { FlatButton, RaisedButton, Paper } from 'material-ui'

let getUrl = () => `http://${window.location.hostname}:3001`

export default () => (
    <div key='system-update-content-page'>
      <Paper style={{paddingTop:16, paddingBottom:8}}>
        <div style={{fontSize:24, opacity:0.87, marginLeft:16, marginBottom:16}}>Appifi Bootstrap</div>
        <div style={{fontSize:15, opacity:0.87, marginLeft:16, marginBottom:24}}>
        There is a standalone and dedicated program to manage Appifi service, for downloading latest version, installing and uninstalling, as well as starting and stopping Appifi service. 
        <br />
        This maintenance tool is named as Appifi Bootstrap and can be access through port 3001. 
        <br />
        Click the following button to navigate to Appifi Bootstrap.
        </div>
        <div style={{marginLeft:8}}><FlatButton label='go to appifi bootstrap' primary={true} onTouchTap={() => window.open(getUrl())}/></div>
      </Paper>
    </div>
  )

