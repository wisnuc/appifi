import React from 'react'

import { Paper, Divider } from 'material-ui'

class Storage extends React.Component {

  render() {

    const headerStyle = {
      fontSize: '24px',
      color: 'rgba(0, 0, 0, 0.87)',
      display: 'block',
      lineHeight: '36px'
    }    

    return (
        <Paper style={{padding: 16}}>
        <span style={headerStyle}>Hello World</span>
        <Divider />
        <p>This is is the best part</p>
      </Paper>
    )
  }
}

export default Storage


