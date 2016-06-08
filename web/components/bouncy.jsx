import React from 'react'

import {Avatar, LinearProgress} from 'material-ui'

export const BouncyCardHeaderLeftText = ({text, width}) => 
  <div style={{fontSize:14, opacity:0.54, width: width ? width : 'auto'}}>{text}</div> 


export const BouncyCardHeaderLeft = ({avatar, title, onClick, children}) => (
    <div style={{height:56, display:'flex', alignItems:'center', flexGrow:1}} onClick={onClick} >
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', width:40, margin:8}}>
        <Avatar src={avatar} size={40} />
      </div>
      <div style={{fontSize:14, fontWeight:'bold', opacity:0.87, width:200}}>{title}</div>
      { children }
    </div>)

