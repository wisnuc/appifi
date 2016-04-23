import React from 'react'

import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'
import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'

class ContainerCard extends React.Component {

  constructor(props) {
    super(props)
  }

  buildCardItem = (container, index) => {

    return ( 
      <Card key={index} style={{marginBottom: '24px'}} >
        <CardHeader title={container.Names[0].slice(1)} subtitle={'State: ' + container.State} actAsExpander={true} showExpandableButton={true} />
        <CardActions style={{backgroundColor: '#EEEEEE'}}>
          <FlatButton label="Start" secondary={true} disabled={ container.State === 'running'} /> 
          <FlatButton label="Stop" secondary={true} disabled={ container.State !== 'running'} />
        </CardActions>
        <CardText expandable={true}>
          <h3>Container Name</h3>
          <h3>Environment Variables</h3>
          <h3>Network Ports</h3>
          <h3>Data Volume</h3>       
        </CardText>
        <CardActions expandable={true}>
          <RaisedButton label="Delete" />
        </CardActions>
      </Card>
    )
  }
 
  render () {

    let docker = window.store.getState().docker

    if (docker.containersRequest) {
      return <div><CircularProgress size={2} /></div>
    }

    let containers = docker.containers

    if (!containers.length) {
      return <div/>
    }

    return (
    <div style={{ display: 'flex', flexDirection: 'row'}}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        { containers
            .filter((item, index) => index % 3 === 0)
            .map(this.buildCardItem)}
      </div>
      <div style={{ width:24 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        { containers
            .filter((item, index) => index % 3 === 1)
            .map(this.buildCardItem)}
      </div>
      <div style={{ width:24 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        { containers
            .filter((item, index) => index % 3 === 2)
            .map(this.buildCardItem)}
      </div>
     </div>
   )
  }
}

class InstalledApps extends React.Component {

  render() {

    const headerStyle = {
      fontSize: '24px',
      color: 'rgba(0, 0, 0, 0.87)',
      display: 'block',
      lineHeight: '36px'
    }

    let state = window.store.getState().docker

    return (
      <div>
        <ContainerCard />
      </div> 
    )
  }
}

export default InstalledApps


