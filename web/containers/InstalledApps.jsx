import React from 'react'

import { Paper, Avatar } from 'material-ui'
import { List, ListItem } from 'material-ui/List'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'
import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'
import CommunicationEmail from 'material-ui/svg-icons/communication/email'
import reactClickOutside from 'react-click-outside'

class ListRowLeft extends React.Component {

  static propTypes = {
    selected: React.PropTypes.bool.isRequired,
    avatar: React.PropTypes.string.isRequired,
    title: React.PropTypes.string.isRequired,
    text: React.PropTypes.string.isRequired,
    onClick: React.PropTypes.func.isRequired,
    onClickOutside: React.PropTypes.func.isRequired,
  }
 
  handleClickOutside() {

    if (!this.props.selected) return
    console.log('click outside')
    this.props.onClickOutside()
  }
 
  render() {
    return (
      <div 
        style={{
          height: '100%',// TODO 
          flexGrow:1,
          display: 'flex', 
          alignItems: 'center', 
          padding:8,
        }} 
        onClick={()=>this.props.onClick()}
      >
        <Avatar style={{marginLeft:8, marginRight:24}} src={this.props.avatar} />
        <div style={{fontSize:14, fontWeight:600, width:200}}>{this.props.title}</div>
        <div style={{fontSize:14, fontWeight:300, color:'gray'}}>{this.props.text}</div>
      </div>
    )
  }
}

let EnhancedListRowLeft = reactClickOutside(ListRowLeft)

let selected = -1


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
          width: index===selected ? '100%':'96%',
          height: index===selected ? '240px' : 'auto',
          marginTop: index===selected ? 24:0,
          marginBottom: index===selected ? 24:0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
        rounded={false}
        zDepth={index===selected ? 2:1}
      >
        <EnhancedListRowLeft
          selected={selected === index ? true : false}
          avatar='http://lorempixel.com/100/100/nature/'
          title={container.Names[0].slice(1)}
          text='Hello World!'
          onClick={() => {
            selected = selected === index ? -1 : index
            window.store.dispatch({type: 'trigger'})
          }}
          onClickOutside={() => {
            console.log('onClickOutside ...')
            if (selected === index) {
              console.log(selected)
              console.log(index)
              selected = -1
              window.store.dispatch({type: 'trigger'})
            }
          }}
        /> 
        <div style={{ display: 'flex', alignItems: 'center', padding:8 }}>
          <FlatButton label="start" />
        </div>
      </Paper>
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

export default () => {
  return <InstalledApps key='installed-apps-list' />
}


