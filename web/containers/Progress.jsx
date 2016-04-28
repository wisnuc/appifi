import React from 'react'
import { CircularProgress } from 'material-ui'
import Transition from '../utils/transition'

const Progress = ({mount, text}) => {

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        padding: 32,
        fontSize: '28px',
        fontWeight: '100',
      }}>{text}</div>
      <CircularProgress />
    </div>
  )
}

Progress.propTypes = {
  text: React.PropTypes.string.isRequired
}

export default Progress

