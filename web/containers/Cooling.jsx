import React from 'react'

import { FlatButton, Paper, Divider, IconButton } from 'material-ui'

import ArrowUp from 'material-ui/svg-icons/hardware/keyboard-arrow-up'
import ArrowDown from 'material-ui/svg-icons/hardware/keyboard-arrow-down'

import palette from '../utils/palette'
import { themeStore } from '../utils/storeState'

const Cooling = () => {

  const colors = palette(themeStore())
  const titleStyle = {
    width:240,
    height:48,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#FFF',
    backgroundColor: colors.primary3Color,
    opacity:1,
    display:'flex',
    alignItems: 'center',
    justifyContent:'center',
  }

  const footerStyle = {
    width:240,
    height:96,
    fontSize: 16,
    opacity:0.54,
    display:'flex',
    flexDirection:'column',
    alignItems: 'center',
    justifyContent:'center'
  }

  console.log(colors)

  return (
    <div >
      <div style={{display:'flex'}}>
        <Paper style={{padding:0}}>
          <div style={titleStyle}>SCALE</div>
          <Divider />
          <div style={{height:48}} />
          <div style={{width:240, height:144, 
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
            <FlatButton icon={<ArrowUp />} primary={true} />
            <div style={{fontSize:34, margin:8, 
              opacity:0.54, display:'flex', justifyContent:'center'}}>100%</div>
            <FlatButton icon={<ArrowDown />} primary={true} />
          </div>
          <div style={footerStyle}>
            <div>Click arrow to</div>
            <div>adjust fan speed</div>
          </div>
        </Paper>
        <Paper style={{padding:0, marginLeft:24}}>
          <div style={titleStyle}>FAN SPEED</div>
          <Divider />
          <div style={{height:48}} />
          <div style={{width:240, height:144, fontSize:56, opacity:0.87,
            display:'flex', alignItems: 'center', justifyContent: 'center',
            color: colors.primary1Color }}>2937</div>
          <div style={footerStyle}>unit: RPM</div>
        </Paper>
      </div>
    </div>
  )
}

export default Cooling
