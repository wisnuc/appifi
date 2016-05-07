import React from 'react'
import { CircularProgress } from 'material-ui'
import Transition from '../utils/transition'

const Progress = ({text, busy}) => {

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        marginTop: 32,
        padding: 32,
        fontSize: '28px',
        fontWeight: '100',
      }}>{text}</div>
      { busy && 
        <CircularProgress />
      }
    </div>
  )
}

Progress.propTypes = {
  busy: React.PropTypes.bool.isRequired,
  text: React.PropTypes.string.isRequired
}

export default Progress

