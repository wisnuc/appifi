import React from 'react'
import ReactDom from 'react-dom'

import { RaisedButton } from 'material-ui'

import { dispatch } from '../utils/storeState'

const renderPowerOff = () => {

  return (
    <div key='power-off-content-page'>
      <div style={{fontSize:16, marginBottom:16, opacity:0.54}}>
        Click the following button to power off or reboot the machine
      </div>
      <RaisedButton label='Power Off' onTouchTap={() => dispatch({
        type: 'SERVEROP_REQUEST',
        data: { operation: 'systemPowerOff' }
      })} />
      <RaisedButton style={{marginLeft:16}} label='Reboot' onTouchTap={() => dispatch({
        type: 'SERVEROP_REQUEST',
        data: { operation: 'systemReboot' }
      })} />
    </div>
  )
}

export default renderPowerOff
