import React from 'react'

import { Paper, Avatar } from 'material-ui'
import {List, ListItem} from 'material-ui/List'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'
import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'
import CommunicationEmail from 'material-ui/svg-icons/communication/email'

class ContainerCard extends React.Component {

  buildCardItem = (container, index) => {

    return ( 
      <Card key={index} 
        style={{
          width: index=== 1 ? '100%':'90%',
          marginTop: index===1 ? 24:0,
          marginBottom: index===1 ? 24:0
        }} zDepth={1} rounded={false}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
            <CardHeader 
              style={{fontSize:16, fontWeight:800, paddingTop:'8px', paddingBottom:'8px', paddingLeft:'16px', paddingRight:'16px'}}
              avatar="http://lorempixel.com/100/100/nature/"
              title={container.Names[0].slice(1)} 
              actAsExpander={false} 
              showExpandableButton={false} 
            />
            <CardText>
              Hello World!
            </CardText>
          </div>
          <CardActions>
            <FlatButton label="Start" secondary={true} disabled={ container.State === 'running'} /> 
            <FlatButton label="Stop" secondary={true} disabled={ container.State !== 'running'} />
            <FlatButton label="Open" secondary={true} />
          </CardActions>
        </div>
      </Card>
    )
  }

  buildRowItem = (container, index) => {
    
    return (
      <Paper
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        rounded={false}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding:8 }}>
          <Avatar style={{marginLeft:8, marginRight:24}} src="http://lorempixel.com/100/100/nature/" />
          <span style={{fontSize:16, fontWeight:700}}>{container.Names[0].slice(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding:8 }}>
          <FlatButton label="start" />
        </div>
      </Paper>
    )
  }

  fillUpper() {
  }

  fillLower() {
  }

  fillActive() {
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
      <div>
        { containers.map(this.buildRowItem) }
      </div>
    )

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


