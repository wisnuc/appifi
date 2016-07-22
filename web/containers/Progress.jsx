import React from 'react'
import { CircularProgress } from 'material-ui'

const Progress = ({text, busy}) => (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ marginTop: 32, padding: 32, fontSize:28, fontWeight:'100' }}>{text}</div>
      { busy && <CircularProgress /> }
    </div>
  )

Progress.propTypes = {
  busy: React.PropTypes.bool,
  text: React.PropTypes.string.isRequired
}

export default Progress

