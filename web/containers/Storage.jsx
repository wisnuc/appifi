import React from 'react'
import { Card, CardTitle, CardHeader, CardText, CardMedia } from 'material-ui/Card'
import { Table, TableBody, TableHeader, TableHeaderColumn, TableRow, TableRowColumn } from 'material-ui/Table'
import { FlatButton, RaisedButton, FloatingActionButton, Avatar, Paper, Divider, Checkbox } from 'material-ui'
import IconAVStop from 'material-ui/svg-icons/av/stop'
import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'

import { LabeledText, Spacer } from './CustomViews'
import { dispatch, storageStore, storageState, dockerState } from '../utils/storeState'
import Transition from '../utils/transition'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

import FlipMove from 'react-flip-move'

import { 
  BouncyCardHeaderLeft,
  BouncyCardHeaderLeftText
} from '../components/bouncy'

// let getStore = () => window.store.getState().storage
let getStore = () => window.store.getState().server.state.storage
let getRequest = () => window.store.getState().storage.request
let dockerStore = () => window.store.getState().docker

let shrinkedCardStyle = { width: '100%', marginTop: 0, marginBottom: 0 }
let expandedCardStyle = { width: '100%', marginTop: 24, marginBottom: 24 }

class DialogExampleModal extends React.Component {

  state = {
    open: false,
  };

  handleOpen = () => {
    this.setState({open: true});
  };

  handleClose = () => {
    this.setState({open: false});
  };

  render() {
    const actions = [
      <FlatButton label="Cancel" primary={true} onTouchTap={this.handleClose} />,
      <FlatButton label="Submit" primary={true} disabled={true} onTouchTap={this.handleClose} />,
    ];

    return (
      <div>
        <FlatButton label="Modal Dialog" onTouchTap={this.handleOpen} />
        <Dialog
          title="Dialog With Actions"
          actions={actions}
          modal={true}
          open={this.state.open}
        >
          Only actions can close this dialog.
        </Dialog>
      </div>
    );
  }
}

let renderStorageNonAvail = () => {

  let storage = getStore()

  if (storage === null) {
    return <div>storage not available</div> // FIXME
  }

  if (storage instanceof Error) {
    console.log(storage.stack)
    return <div>{`${storage.name}: ${storage.message}`}, retry please</div>
  }

  return null
}

let findDiskForPort= (port) => {

  let debug = false
  let blocks = getStore().blocks

  debug && console.log(blocks)

  /** excluding partition **/
  let disks = blocks.filter((block) => block.props.devtype === 'disk')

  debug && console.log(disks)

  for (let i = 0; i < disks.length; i++) {

    debug && console.log(disks[i].path)
    debug && console.log(port.sysfsProps[1].path)

    if (disks[i].path.startsWith(port.sysfsProps[1].path))
      return disks[i]
  }

  return null
}

let renderVolumeDeviceRow = (device) => {

  return (
    <TableRow key={device.id}>
      <TableRowColumn>{device.id}</TableRowColumn>
      <TableRowColumn>{device.path}</TableRowColumn>
      <TableRowColumn>{device.size}</TableRowColumn>
      <TableRowColumn>{device.used}</TableRowColumn>
    </TableRow>
  )
}

let renderVolumeCard = (volume) => {

  let {ports, blocks, volumes, mounts, swaps, usages} = storageState()
  let docker = dockerState()

  let request = getRequest()

  let rowStyle = {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
  }

  let leftColStyle = {
    flex: 1,
    fontSize: 20,
    opacity: 0.54
  }

  let rightColStyle = {
    flex: 2,
  }

  let usage = usages.find(u => u.mountpoint.endsWith(volume.uuid))

  let running = docker !== null
  let runningOnMe = (docker && docker.volume === volume.uuid) ? true : false

  let daemonStartingOnMe = (request) => {
    if (request) {
      let op = request.operation
      return (op.operation === 'daemonStart' && op.args && op.args.length && op.args[0] === volume.uuid) ? true : false
    } 
    return false
  }

  let daemonStoppingOnMe = (request) => {
    if (request) {
      let op = request.operation
      return (op.operation === 'daemonStop' && op.args && op.args.length && op.args[0] === volume.uuid) ? true : false
    } 
    return false
  }

  let daemonOperatingOnMe = (request) => daemonStartingOnMe(request) || daemonStoppingOnMe(request)

  let daemonStart = (uuid) => {

    console.log('daemonStart')
    console.log(uuid)

    window.store.dispatch({ 
      type: 'DOCKER_OPERATION',
      operation: { 
        operation: 'daemonStart',
        args: [uuid]
      }
    })
  }


  let daemonStop = (uuid) => {
    window.store.dispatch({
      type: 'DOCKER_OPERATION',
      operation: {
        operation: 'daemonStop',
        args: [uuid]
      }
    }) 
  }

  let bannerText = () => {
    if (!running) {
      return 'AppEngine is not running. Click START button to  start it on this volume.'
    }
    else if (runningOnMe) {
      return 'AppEngine is running on this volume'
    }
    else {
      return 'AppEngine is running on other volume'
    }
  }

  let expanded = volumeExpanded(volume)

  let volumeCardOnClick = () => 
    dispatch({
      type: 'STORAGE_CARD_EXPANSION_TOGGLE',
      data: {
        type: 'volume',
        id: volume.uuid
      }
    })

  return (
    <div>
      <Paper style={expanded ? expandedCardStyle : shrinkedCardStyle} zDepth={expanded ? 2 : 1}>
        <div style={{display:'flex', alignItems: 'center'}} >
          <BouncyCardHeaderLeft title='btrfs' onClick={volumeCardOnClick}>
            <BouncyCardHeaderLeftText text={bannerText()} />
          </BouncyCardHeaderLeft>
          <div>
            <RaisedButton style={{marginRight:16}} label='start' primary={true} disabled={running} 
              onTouchTap={() => daemonStart(volume.uuid)} />
            <RaisedButton style={{marginRight:16}} label='stop' secondary={true} disabled={!runningOnMe} 
              onTouchTap={() => daemonStop(volume.uuid)} />
          </div>
        </div>
        { expanded ? (<div>
        <Divider />
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>General</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='label' text={volume.label ? volume.label : '(none)'} right={2} />
              <LabeledText label='volume uuid' text={volume.uuid} right={2} />
              <LabeledText label='number of disks' text={volume.total} right={2} />
              <LabeledText label='mount point' text='/run/wisnuc/volumes/xxxxxx' right={2}/>
            </div>
          </div>
        </div>
        <Divider />
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Usage</div>
            { usage.overall ? (
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='data size' text={usage.overall.deviceSize} right={2} />
              <LabeledText label='device allocated' text={usage.overall.deviceAllocated} right={2} />
              <LabeledText label='device unallocated' text={usage.overall.deviceUnallocated} right={2} />
              <LabeledText label='device missing' text={usage.overall.deviceMissing} right={2} />
              <LabeledText label='used space' text={usage.overall.used} right={2} />
              <LabeledText label='free space (estimated)' text={usage.overall.free} right={2} />
              <LabeledText label='free space (minimal)' text={usage.overall.freeMin} right={2} />
              <LabeledText label='data ratio' text={usage.overall.dataRatio} right={2} />
              <LabeledText label='metadata ratio' text={usage.overall.metadataRatio} right={2} />
              <LabeledText label='global reserve (total)' text={usage.overall.globalReserve} right={2} />
              <LabeledText label='global reserve (used)' text={usage.overall.globalReserveUsed} right={2} /> 
            </div>
            ) : null }
          </div>
        </div>
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>System</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='mode' text={usage.system.mode} right={2} />
              <LabeledText label='size' text={usage.system.size} right={2} />
              <LabeledText label='used' text={usage.system.used} right={2} />
            </div>
          </div>
        </div>
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Metadata</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='mode' text={usage.metadata.mode} right={2} />
              <LabeledText label='size' text={usage.metadata.size} right={2} />
              <LabeledText label='used' text={usage.metadata.used} right={2} />
            </div>
          </div>
        </div>
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Data</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='mode' text={usage.data.mode} right={2} />
              <LabeledText label='size' text={usage.data.size} right={2} />
              <LabeledText label='used' text={usage.data.used} right={2} />
            </div>
          </div>
        </div>
        </div>) : null }
      </Paper>
    </div>
    )
}

let renderVolumes = () => {

  let storage = storageState()
  if (storage === null) {
    return <div>storage not available</div> // FIXME
  }

  if (storage instanceof Error) {
    console.log(storage.stack)
    return <div>{`${storage.name}: ${storage.message}`}, retry please</div>
  }

  let {ports, blocks, volumes, mounts, swaps} = storage

  if (volumes && volumes.length) {
    return <div>{ volumes.map(volume => renderVolumeCard(volume)) }</div>
  }

  return <div>no volumes detected, please create a volume.</div>
}

let buildDrives = () => {

  let blocks = getStore().blocks
  let disks = blocks
              .filter((block) => block.props.devtype === 'disk')
              .map((block) => {
                return { block, children:[] }
              })

  disks.forEach((disk) => {
    blocks.forEach((block) => {
      if (block.props.devtype === 'partition' && block.path.startsWith(disk.block.path)) {
        disk.children.push(block)
      }
    })

    if (disk.children.length) {
      disk.children.sort((a, b) => a.name.localeCompare(b.name))
    }
  })

  disks.sort((a, b) => a.block.name.localeCompare(b.block.name))
  return disks
}

let renderPartitionRow = (partition) => {
  
}


let renderDriveCard = (drive) => {

  let { name, props, sysfsProps } = drive.block
  let parted = props.id_part_table_type !== undefined
  let raid = props.id_fs_usage === 'filesystem'
  
  return (
    <Card key={name}>
      <CardTitle 
        title={props.id_model} 
        subtitle={
          'serial number: ' + props.id_serial_short.toUpperCase() + ' '
          + 'size: ' + parseInt(sysfsProps[0].attrs.size) / 2 + ' KB' 
        } 
      >
        <div>USAGE { parted ? '(Partitioned)' : raid ? '(File System)' : '(Unrecognized)' }</div>
        { parted && <div>partition type: {props.id_part_table_type} </div> }
        { parted && <div>partition table UUID: {props.id_part_table_uuid.toUpperCase()} </div> }
        { raid && <div>type: {props.id_fs_type} </div> }
        { raid && <div>UUID: {props.id_fs_uuid.toUpperCase()} </div> }
        { raid && <div>sub-UUID: {props.id_fs_uuid_sub.toUpperCase()} </div> }
      </CardTitle>
    </Card>
  )    
}

let renderMountRow = (mount) => {

  return (
    <TableRow key={mount.mountpoint}>
      <TableRowColumn>{mount.device}</TableRowColumn>
      <TableRowColumn>{mount.fs_type}</TableRowColumn>
      <TableRowColumn>{mount.mountpoint}</TableRowColumn>
      <TableRowColumn>{
        mount.opts.map((opt, index) => {
          return <div key={mount.device + '.' + index}>{opt}</div>
        })
      }</TableRowColumn>
    </TableRow>
  )
}

let renderMounts = () => {

  return (
    <Table selectable={false}>
      <TableHeader enableSelectAll={false} displaySelectAll={false} adjustForCheckbox={false} >
        <TableRow>
          <TableHeaderColumn>Dev Name</TableHeaderColumn>
          <TableHeaderColumn>File System</TableHeaderColumn>
          <TableHeaderColumn>Mount Point</TableHeaderColumn>
          <TableHeaderColumn>Options</TableHeaderColumn>
        </TableRow>
      </TableHeader>
      <TableBody displayRowCheckbox={false}>
        { getStore().mounts.map((mount) => renderMountRow(mount)) }
      </TableBody>
    </Table>
  )
}

let portColStyle = [
  { width: '30px'},
  { width: '60px'},
  {},
  {},
  {},
  { width: '120px'}
]

let renderPortRow = (port) => {
 
  let debug = false
 
  let portName = port.sysfsProps[0].kernel
  let disk = findDiskForPort(port)

  let blockDevName = disk ? disk.props.devname : ''
  let diskModel = disk ? disk.props.id_model : ''

  let fileSystem
  if (disk) {
    if (disk.props.id_fs_type !== undefined) {
      fileSystem = disk.props.id_fs_type
    }
    else if (disk.props.id_part_table_type !== undefined) {
      fileSystem = disk.props.id_part_table_type + ' partition'
    }
    else {
      fileSystem = 'unrecognized'
    }
  }
  else {
    fileSystem = ''
  }

  debug && console.log(portName)
  debug && console.log(disk)
  debug && console.log(blockDevName)
  debug && console.log(diskModel)
  debug && console.log(fileSystem)

  return (
    <TableRow key={portName} >
      <TableRowColumn style={portColStyle[0]}>{portName}</TableRowColumn>
      <TableRowColumn style={portColStyle[1]}>{blockDevName}</TableRowColumn>
      <TableRowColumn style={portColStyle[2]}>{diskModel}</TableRowColumn>
      <TableRowColumn style={portColStyle[3]}>{fileSystem}</TableRowColumn>
      <TableRowColumn style={portColStyle[4]}>{ disk ? 'TODO' : '' }</TableRowColumn> 
      <TableRowColumn style={portColStyle[5]}>{ disk ? 'TODO' : '' }</TableRowColumn> 
    </TableRow>
  ) 
}

let renderATAPorts = () => {

  return (
    <Paper>
      <Table selectable={false}>
        <TableHeader enableSelectAll={false} displaySelectAll={false} adjustForCheckbox={false} >
          <TableRow>
            <TableHeaderColumn style={portColStyle[0]}>Port</TableHeaderColumn>
            <TableHeaderColumn style={portColStyle[1]}>Dev Name</TableHeaderColumn>
            <TableHeaderColumn style={portColStyle[2]}>Disk</TableHeaderColumn>
            <TableHeaderColumn style={portColStyle[3]}>FileSystem</TableHeaderColumn>
            <TableHeaderColumn style={portColStyle[4]}>Mounted</TableHeaderColumn>
            <TableHeaderColumn style={portColStyle[5]}>Operation</TableHeaderColumn>
          </TableRow>
        </TableHeader>
        <TableBody displayRowCheckbox={false}>
          { getStore().ports.map((port) => renderPortRow(port)) }
        </TableBody>
      </Table>
    </Paper>
  )
}

const renderDriveHeaderLeft = (avatar, title, text, onClick) => {

  let style = { height: '100%', flexGrow:1, display: 'flex', alignItems: 'center', padding:8 }
  return (
    <div style={style} onClick={onClick} >
      <Avatar style={{marginLeft:8, marginRight:24}} src={avatar} />
      <div style={{fontSize:15, fontWeight:'bold', opacity:0.87, width:200}}>{title}</div>
      <div style={{fontSize:13, opacity:0.54}}>{text}</div>
    </div>
  )
}

const driveIsNewVolumeCandidate = (drive) => {
  
  let storage = storageStore()

  if (storage.creatingVolume && 
      storage.newVolumeCandidates.find(candi => candi === driveKey(drive))) 
    return true
  return false
}

const drivePartitionAsRoot = (drive) => {

  let rootMount = storageState().mounts.find(mnt => mnt.mountpoint === '/')

  return rootMount ? 
    drive.children.find(part => part.props.devname === rootMount.device) : 
      null
}

const driveHasPartitionsAsSwap = (drive) => {

  const swap = (partition) => 
    storageState().swaps.find(swp => 
      swp.filename === partition.props.devname)

  return drive.children.find(part => swap(part)) ? true : false
}

const driveIsRemovable = (drive) => drive.block.sysfsProps[0].attrs.removable === '1'
const driveIsUSB = (drive) => drive.block.props.id_bus === 'usb'

// this function returns null as OK and a string as disallowance reason
const driveIsAllowedForNewVolumeCandidate = (drive) => {

  if (drivePartitionAsRoot(drive))
    return 'drive contains root partition'

  if (driveHasPartitionsAsSwap(drive))
    return 'drive contains swap partition'

  if (driveIsUSB(drive))
    return 'drive is USB drive'

  return null
}

const DriveCardHeaderRightButton = ({label, disabled, primary, onTouchTap}) => {

  return (
    <ReactCSSTransitionGroup
      transitionName="example" 
      transitionAppear={true}
      transitionEnter={true}
      transitionLeave={true}
      transitionAppearTimeout={300}
      transitionEnterTimeout={300} 
      transitionLeaveTimeout={300}
    >
      <div><FlatButton style={{marginRight:16}} label={label} disabled={disabled} onTouchTap={onTouchTap} primary={primary} /></div>
    </ReactCSSTransitionGroup>
  )
}

const DriveCardHeaderRightText = ({text}) => {

  return <div>{text}</div>
}

const renderDriveHeaderRight = (drive) => {

  if (storageStore().creatingVolume !== 2) return null

  const renderAddRemoveButton = (label, onTouchTap) => 
    (
      <ReactCSSTransitionGroup
        transitionName="example" 
        transitionAppear={true}
        transitionEnter={true}
        transitionLeave={true}
        transitionAppearTimeout={300}
        transitionEnterTimeout={300} 
        transitionLeaveTimeout={300}
      >
        <div><FlatButton style={{marginRight:16}} label={label} onTouchTap={onTouchTap} /></div>
      </ReactCSSTransitionGroup>
    )
  
  let disallow = driveIsAllowedForNewVolumeCandidate(drive)
  if (disallow) {
    return <div>{disallow}</div>
  } 

  if (driveIsNewVolumeCandidate(drive)) {
    return renderAddRemoveButton('remove', () => {
      dispatch({
        type: 'STORAGE_REMOVE_NEW_VOLUME_CANDIDATE',
        data: driveKey(drive)
      })
    })
  } 
  else {
    return renderAddRemoveButton('add', () => {
      dispatch({
        type: 'STORAGE_ADD_NEW_VOLUME_CANDIDATE',
        data: driveKey(drive)
      })
    })
  }
}


const driveKey = (drive) => drive.block.props.id_serial

const driveExpanded = (drive) => 
  storageStore().expansions.find(exp => 
    exp.type === 'drive' && exp.id === driveKey(drive))

const volumeExpanded = (volume) => 
  storageStore().expansions.find(exp => 
    exp.type === 'volume' && exp.id === volume.uuid)

const creatingVolumeSubmitted = () => {

  let { creatingVolume, operation } = storageStore()
  let submitted

  if (creatingVolume === 2 &&
      operation &&
      operation.request &&
      operation.data.operation === 'mkfs_btrfs') {
    submitted = true
  }
  else {
    submitted = false
  }

  console.log(`submitted ${submitted}`)
  return submitted
}

const creatingVolumeFinished = () => {

  let { creatingVolume, operation } = storageStore()

  let finished
  if (creatingVolume === 2 &&
      operation &&
      operation.request === null &&
      operation.data.operation === 'mkfs_btrfs') {
    finished = true
  }
  else {
    finished = false
  }

  console.log(`finished ${finished}`)
  return finished
}

const renderDriveCardHeader = (drive) => {

  const onClick = () => dispatch({ type: 'STORAGE_CARD_EXPANSION_TOGGLE', data: { type: 'drive', id: driveKey(drive) } }) 
  const removeButtonOnTouchTap = () => dispatch({ type: 'STORAGE_REMOVE_NEW_VOLUME_CANDIDATE', data: driveKey(drive) })
  const addButtonOnTouchTap =  () => dispatch({ type: 'STORAGE_ADD_NEW_VOLUME_CANDIDATE', data: driveKey(drive) })

  let { creatingVolume } = storageStore()
  let middleText

  let disallowed = driveIsAllowedForNewVolumeCandidate(drive)
  if (creatingVolume) {
    middleText = disallowed ? 'This drive can not be added to new volume, ' + disallowed : 'This drive can be added to new volume'
  }
  else {
    middleText = `Size: ${drive.block.sysfsProps[0].attrs.size} (in 512 byte blocks)`
  }

  let isCandidate = driveIsNewVolumeCandidate(drive)
  let buttonLabel = isCandidate ? 'remove' : 'add'
  let buttonOnTouchTap = isCandidate ? removeButtonOnTouchTap : addButtonOnTouchTap

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <BouncyCardHeaderLeft title={drive.block.props.id_model} onClick={onClick}>
        <BouncyCardHeaderLeftText text={middleText} />
      </BouncyCardHeaderLeft>
      { creatingVolume ? (
        <DriveCardHeaderRightButton label={buttonLabel} disabled={disallowed} primary={true} onTouchTap={buttonOnTouchTap} />
      ) : (
        null
      )}
    </div>
  ) 
}

const renderPartition = (block) => {
 
  return (
    <div>
      <div style={{display:'flex'}}>
        <div style={{width:56}} /> 
        <div style={{paddingTop:16, paddingBottom:16, width:200,
          fontSize:16, fontWeight:'bold', opacity:0.54}}>General</div>
        <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
          <LabeledText label='device name' text={drive.block.props.devname} right={4} />
          <LabeledText label='device path' text={drive.block.props.devpath} right={4} />
          <LabeledText label='device type' text={drive.block.props.devtype} right={4} />
          { drive.block.props.id_fs_type ? <LabeledText label='fstype' text={drive.block.props.id_fs_type} right={4} /> : null }
        </div>
      </div>
    </div>
  ) 
}

const renderDriveCardContent = (drive) => {

  let ccdRowStyle = { width: '100%', display: 'flex', flexDirection: 'row', }
  let ccdLeftColStyle = { flex: 1, fontSize: 15, opacity:0.87 }
  let ccdRightColStyle = { flex: 3 }
  let block = drive.block

  return (
    <div>
      <Divider />
      <div>
        <div style={{display:'flex'}}>
          <div style={{width:56}} /> 
          <div style={{paddingTop:16, paddingBottom:16, width:200,
            fontSize:16, fontWeight:'bold', opacity:0.54}}>Disk Information</div>
          <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
            <LabeledText label='device name' text={block.props.devname} right={4} />
            <LabeledText label='device path' text={block.props.devpath} right={4} />
            <LabeledText label='device type' text={block.props.devtype} right={4} />
            <LabeledText label='bus' text={block.props.id_bus} right={4} />
            <LabeledText label='size (block)' text={block.sysfsProps[0].attrs.size} right={4} />
            <LabeledText label='removable' text={block.sysfsProps[0].attrs.removable === '1' ? 'yes' : 'no'} right={4} />
          </div>
        </div>
      </div>
      <Divider />
      { block.props.id_part_table_type ? (
        <div style={{display:'flex'}}>
          <div style={{width:56}} /> 
          <div style={{paddingTop:16, paddingBottom:16, width:200,
            fontSize:16, fontWeight:'bold', opacity:0.54}}>Partition Table</div>
          <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
            <LabeledText label='type' text={block.props.id_part_table_type} right={4} />
            <LabeledText label='uuid' text={block.props.id_part_table_uuid} right={4} />
          </div>
        </div> 
        ) : null } 
      { block.props.id_fs_type ? (
        <div style={{display:'flex'}}>
          <div style={{width:56}} /> 
          <div style={{paddingTop:16, paddingBottom:16, width:200,
            fontSize:16, fontWeight:'bold', opacity:0.54}}>File System</div>
          <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
            <LabeledText label='type' text={block.props.id_fs_type} right={4} />
            <LabeledText label='usage' text={block.props.id_fs_usage} right={4} />
            <LabeledText label='uuid (volume)' text={block.props.id_fs_uuid} right={4} />
            <LabeledText label='uuid (disk)' text={block.props.id_fs_uuid_sub} right={4} />
          </div>
        </div> 
        ) : null } 
    </div>
  )
}

const renderContainerCard = (container) => {

  let deselected = { width: '98%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 24, marginBottom: 24 }

  let select = installedStore().select
  let me = (select && select.type === 'container' && select.id === container.Id)

  return (
    <Paper style={ me ? selected : deselected } key={container.Id} rounded={false} zDepth={ me ? 2 : 0 } >
      { renderContainerCardHeader(container) }
      { me && renderContainerCardContent(container) } 
      { me && renderContainerCardFooter(container) }
    </Paper>
  )
}

const renderDriveCard2 = (drive) => {

  let deselected = { width: '100%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 16, marginBottom: 16 }

  let expanded = driveExpanded(drive)

  console.log(driveKey(drive))
  let key = driveKey(drive)

  // paper key TODO
  return (
    <div key={key} style={{transition:'top 300ms'}}>
    <Paper key={key} style={ expanded ? selected : deselected } rounded={false} zDepth={ expanded ? 2 : 1 } >
      { renderDriveCardHeader(drive) }
      { expanded && renderDriveCardContent(drive) } 
    </Paper>
    </div>
  )
}

let renderDrives = () => {

  let drives = buildDrives()
  return drives.map(drive => renderDriveCard2(drive)) 
}

let renderNonCandidateDrives = () => {

  let drives = buildDrives()
  let filtered = drives.filter(drive => 
    !storageStore().newVolumeCandidates.find(candi => candi === driveKey(drive))) 

  return filtered.map(drive => renderDriveCard2(drive))
}

let renderCandidateDrives = () => {

  let drives = buildDrives()

  let filtered = []

  storageStore().newVolumeCandidates.forEach(candi => {
    let drive = drives.find(d => driveKey(d) === candi)
    if (drive) filtered.push(drive)
  })

  return filtered.map(drive => renderDriveCard2(drive))
/*
  let filtered = drives.filter(drive => 
    storageStore().newVolumeCandidates.find(candi => candi === driveKey(drive))) 

  return filtered.map(drive => renderDriveCard2(drive))
*/
}

let candidateBlknames = () => {

  let { blocks } = storageState()
  let serials = storageStore().newVolumeCandidates  
  let filtered = blocks.filter(blk => serials.find(ser => ser === blk.props.id_serial))
  return filtered.map(blk => blk.props.devname)
}

let renderAll = () => {

  let {creatingVolume, newVolumeCandidates} = storageStore()

  let containerStyle = {
    // display: 'flex', 
    // flexDirection:'column', 
    // alignItems:'stretch',
  }

  let creatingVolumeStyle = Object.assign({}, containerStyle, {
    zIndex: -1,
    backgroundColor:'#DDDDDD',
    padding:16,
    transition: 'all 300ms ease 300ms'
  })

  let nonCreatingVolumeStyle = Object.assign({}, containerStyle, {
    zIndex: -1,
    backgroundColor:'transparent',
    padding:0,
    transition: 'all 300ms ease 300ms'
  })

  let createNewVolume = () => {
    dispatch({
      type: 'STORAGE_CREATE_VOLUME_START'
    })
    setTimeout(() => 
      dispatch({
        type: 'STORAGE_CREATE_VOLUME_STARTED'
      }), 600)
  }

  let cancelCreatingNewVolume = () => dispatch({
    type: 'STORAGE_CREATE_VOLUME_CANCEL'
  })
  
  let mainButtonLabel = creatingVolume ? 'cancel' : 'new volume'
  let mainButtonOnTouchTap = creatingVolume ? cancelCreatingNewVolume : createNewVolume
  
  let showRaid0Button = creatingVolume === 2 && newVolumeCandidates.length > 0 
  let raid0ButtonOnTouchTap = () => dispatch({
    type: 'STORAGE_OPERATION',
    data: {
      operation: 'mkfs_btrfs',
      args: [
        {
          mode: 'single',
          blknames: candidateBlknames()
        }
      ]
    }
  })

  let showRaid1Button = creatingVolume === 2 && newVolumeCandidates.length > 1
  let raid1ButtonOnTouchTap = () => dispatch({
    type: 'STORAGE_OPERATION',
    data: {
      operation: 'mkfs_btrfs',
      args: [
        {
          mode: 'raid1',
          blknames: candidateBlknames()
        }
      ]
    }
  })

  let bannerText = () => {
    
    if (!creatingVolume) return 'Disks'
    if (creatingVolumeSubmitted()) return 'Submitting request to server'
    if (creatingVolumeFinished()) return 'Finished'
    return 'Click ADD button to add disk to new volume'
  }

  return (
    <div> 
      <div style={{fontSize:16, opacity:0.54}}>Volumes</div>
      <div style={{height:8}} />
      { renderVolumes() }
      {/* <div style={{marginTop:16, fontSize:16, opacity:0.54}}>Disks</div> */}
      <div style={{height:32}} />
      <div key='new-volume-container' style={creatingVolume ? creatingVolumeStyle : nonCreatingVolumeStyle}>
        <ReactCSSTransitionGroup style={{display:'flex', alignItems: 'center'}}
          transitionName="example" 
          transitionAppear={true}
          transitionEnter={true}
          transitionLeave={true}
          transitionAppearTimeout={300}
          transitionEnterTimeout={300} 
          transitionLeaveTimeout={300}
        >
          <div style={{fontSize:16, opacity:0.54, flexGrow:1}}>
            { bannerText() }
          </div>
          { showRaid1Button && <div><RaisedButton style={{marginRight:16}} label='creating raid1 volume' secondary={true} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={raid1ButtonOnTouchTap} /></div> }
          { showRaid0Button && <div><RaisedButton style={{marginRight:16}} label='creating raid0 volume' secondary={true} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={raid0ButtonOnTouchTap} /></div> }
          <div><RaisedButton label={mainButtonLabel} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={mainButtonOnTouchTap} /></div>
        </ReactCSSTransitionGroup>
        <div style={{height: creatingVolume ? 16 : 8, transition:'300ms'}} />
        <FlipMove style={{marginTop:0}} enterAnimation='fade' leaveAnimation='fade' easing='cubic-bezier(0.23, 1, 0.32, 1)' duration={350} staggerDelayBy={0}>
          { renderCandidateDrives() }
        </FlipMove>
      </div>
      {/* <div style={{height: creatingVolume ? 16 : 0}} /> */}
      <div style={ creatingVolume ? {padding:16, transition:'all 300ms ease 300ms'} : {padding:0, transition:'all 300ms ease 300ms'}}>
        { renderNonCandidateDrives() }
      </div>
      <div style={{height:600}} />
    </div>
  )
}

let Mounts = renderMounts
let Ports = renderATAPorts
let Volumes = renderVolumes
let Drives = renderDrives

/*
 * Target -> mount a file system on certain mount point
 * 
 * State:
 * 
 * dedicated mountpoint mounted (a file system) -> tell user OK -> let user choose to unmount
 * dedicated mountpoint not mounted, 
    1. candidate (a previously used file system exist) (1) reuse it (direct mount) (2) do not reuse it
    2. candidate (a file system exist but not previously used) -> (2) format and use this filesystem.
    3. no candidate, but there are disks
      a) 1 disk -> create btrfs and mount it 
      b) 2 disks -> create btrfs on one or both and mount it
    4. no disks -> tell user what to do.     
 * 
 * dedicated mountpoint is defined as a systemd mount unit file
 * mounted means it has a valid setting and the corresponding volume exists.
 * not mounted means the setting is not valid, volume does not exist, volume exist in file but not exist in system
 * the volume exist in file and system but the volume is broken

    docker mount unit file -> 
      nonexist, bad format, bad volume format, empty volume | valid format { api: property -> null or valid uuid }
    docker mount unit file service status -> services status -> [{name, status}] post new status to update
      started, not started (error existed?)

    existing volume on system -> a collection, including
      -> volume defined for docker
      -> volume not defined for docker
    just data, decision made in client

    if volume already set for docker mount
      if it non exist -> tell user to install back the disk, or clear settings.
      if it exist but bad -> tell user the problem and try a fix if possible
      if it exist and ok -> should start it and then docker automatically
  
    
    docker service status

    
 */

let renderStorage = () => {

  return (
    <div/> 
  )
}

export default { 
//  Volumes: renderVolumes, 
  Volumes: renderAll,
  Drives: renderDrives, 
  Mounts: renderMounts, 
  Ports: renderATAPorts 
}


