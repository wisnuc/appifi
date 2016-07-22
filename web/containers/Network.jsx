import React from 'react'

import { Paper, Divider, FlatButton } from 'material-ui'

import { BouncyCardHeaderLeft, BouncyCardHeaderLeftText } from '../components/bouncy'
import { dispatch, storageStore, serverOpStore, storageState, networkState } from '../utils/storeState'
import { LabeledText, Spacer } from './CustomViews'

const renderIPV4 = (obj) => (
    <div style={{display:'flex'}}>
      <div style={{width:56}} /> 
      <div style={{paddingTop:16, paddingBottom:16, width:200,
        fontSize:16, fontWeight:'bold', opacity:0.54}}>IPv4</div>
      <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
        <LabeledText label='address' text={obj.address} right={4} />
        <LabeledText label='netmask' text={obj.netmask} right={4} />
        <LabeledText label='mac'text={obj.mac} right={4} />
        <LabeledText label='internal' text={obj.internal.toString()} right={4} />
      </div>
    </div> 
  )

const renderIPV6 = (obj) => (
    <div style={{display:'flex'}}>
      <div style={{width:56}} /> 
      <div style={{paddingTop:16, paddingBottom:16, width:200,
        fontSize:16, fontWeight:'bold', opacity:0.54}}>IPv6</div>
      <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
        <LabeledText label='address' text={obj.address} right={4} />
        <LabeledText label='netmask' text={obj.netmask} right={4} />
        <LabeledText label='mac'text={obj.mac} right={4} />
        <LabeledText label='internal' text={obj.internal.toString()} right={4} />
        <LabeledText label='scope id' text={obj.scopeid} right={4} />
      </div>
    </div> 
  )

const renderContent = (net, ipv4, ipv6) => {

  let ccdRowStyle = { width: '100%', display: 'flex', flexDirection: 'row', }
  let ccdLeftColStyle = { flex: 1, fontSize: 15, opacity:0.87 }
  let ccdRightColStyle = { flex: 3 }

  return (
    <div>
      <Divider />
      <div>
        <div style={{display:'flex'}}>
          <div style={{width:56}} /> 
          <div style={{paddingTop:16, paddingBottom:16, width:200,
            fontSize:16, fontWeight:'bold', opacity:0.54}}>Link Information</div>
          <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
            <LabeledText label='address' text={net.address} right={4} />
            <LabeledText label='broadcast' text={net.broadcast} right={4} />
            <LabeledText label='duplex' text={net.duplex} right={4} />
            <LabeledText label='mtu' text={net.mtu} right={4} />
            <LabeledText label='speed' text={net.speed} right={4} />
          </div>
        </div>
      </div>
      { ipv4 && renderIPV4(ipv4) }
      { ipv6 && renderIPV6(ipv6) }
    </div>
  )
}

const renderHeader = (net) => (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <BouncyCardHeaderLeft title={net.name}>
        <BouncyCardHeaderLeftText text={net.operstate} />
      </BouncyCardHeaderLeft>
    </div>
  ) 

const renderCard = (net) => {

  let selected = { width: '100%', marginTop: 16, marginBottom: 16 }

  return (
    <div key={'network-interface-' + net.name} style={{transition:'top 300ms'}}>
      <Paper style={ selected } rounded={true} >
        { renderHeader(net) }
        { renderContent(net, net.ipv4, net.ipv6) } 
      </Paper>
    </div>
  )
}

const render = () => {

  let nets, os
  
  if (networkState() === null) nets = [] 
  else {
    os = networkState().os
    nets = networkState().nets.map(net => 
      Object.assign({}, net, { 
        ipv4: (os[net.name] || []).find(x => x.family === 'IPv4'),
        ipv6: (os[net.name] || []).find(x => x.family === 'IPv6')
      }))
  }

  return (
    <div key='network-content-page'>
      <div style={{display: 'flex', alignItems: 'center', justifyContent:'space-between'}}>
        <div style={{fontSize:16, opacity:0.54}}>Network Interfaces</div>
        <FlatButton label='refresh' onTouchTap={() => dispatch({type: 'SERVEROP_REQUEST', data: { operation: 'networkUpdate' }})} />
      </div>
      { nets.map(renderCard) }
    </div>
  )
}

export default render




