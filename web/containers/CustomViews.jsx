import React from 'react'

let labeledTextStyle = {
  display: 'flex',
  flexDirection: 'row',
  fontSize: 14,
  lineHeight: 1.5
}

const LabeledText = ({label, text, right}) => 
  ( <div style={labeledTextStyle}>
      <div style={{flex:1, fontWeight:100}}>{label}:</div>
    <div style={{flex:right ? right : 2}}>{text}</div></div>)

const Spacer = () => <div style={{height:32}} />

export { LabeledText, Spacer }
