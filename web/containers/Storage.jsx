import React from 'react'
import { Card, CardTitle, CardHeader, CardText, CardMedia } from 'material-ui/Card'
import { Table, TableBody, TableHeader, TableHeaderColumn, TableRow, TableRowColumn } from 'material-ui/Table'
import { FlatButton, RaisedButton, FloatingActionButton, Paper, Divider } from 'material-ui'
import IconAVStop from 'material-ui/svg-icons/av/stop'
import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'

import { LabeledText, Spacer } from './CustomViews'

console.log(LabeledText)
console.log(Spacer)

let getStore = () => window.store.getState().storage
let dockerStore = () => window.store.getState().docker

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
      <FlatButton
        label="Cancel"
        primary={true}
        onTouchTap={this.handleClose}
      />,
      <FlatButton
        label="Submit"
        primary={true}
        disabled={true}
        onTouchTap={this.handleClose}
      />,
    ];

    return (
      <div>
        <RaisedButton label="Modal Dialog" onTouchTap={this.handleOpen} />
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

  let storage = getStore().storage
  let request = getStore().request

  if (storage === null) {
    if (request)
      return <div>busy requesting data</div>
    else
      return <div>state not defined</div>
  }

  if (storage instanceof Error) {
    console.log(storage.stack)
    return <div>{`${storage.name}: ${storage.message}`}, retry please</div>
  }

  return null
}

let findDiskForPort= (port) => {

  let debug = false
  let blocks = getStore().storage.blocks

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

let renderVolumeRow = (volume) => {

  let {ports, blocks, volumes, mounts, swaps, usages} = getStore().storage
  let dockerState = dockerStore().docker

  console.log(dockerState)

  let request = getStore().request

  let rowStyle = {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
  }

  let leftColStyle = {
    flex: 1,
    fontSize: 20,
    fontWeight: 100
  }

  let rightColStyle = {
    flex: 2,
  }

  let usage = usages.find(u => u.mountpoint.endsWith(volume.uuid))

  // let running = daemon.volume ? true : false
  let running = dockerState.status > 0
  let runningOnMe = dockerState.volume === volume.uuid ? true : false

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

  return (
  <div>
    <div style={{fontSize: 28, fontWeight:100}}>Btrfs File System (RAID)</div>
    <Paper style={{
        marginTop: '16px',
        width: '100%',
    }}>
      {/* title bar */}
      {/*
      <div id='card-title-bar' style={{
          display: 'flex',
          flexDirection: 'row',   
          alignItems: 'center',
          padding: '16px'
      }}>*/}
      
      {/*  <div style={{fontSize: 24, fontWeight:100, flexGrow:1}}>Btrfs File System (RAID)</div> */}
      {/* </div> */}
      {/* general */}
      <div id='card-important' style={{padding:'16px' }}>
        <div style={rowStyle}>
          <div style={leftColStyle}>General Information</div>
          <div style={rightColStyle}>
            <LabeledText label='label' text={volume.label ? volume.label : '(none)'} />
            <LabeledText label='volume uuid' text={volume.uuid} />
            <LabeledText label='number of disks' text={volume.total} />
            <LabeledText label='mount point' text='/run/wisnuc/volumes/xxxxxx' />
         </div>
        </div>
      </div>

      {/* general */}
      <div id='card-important' style={{padding:'16px', backgroundColor:'#FAFAFA', }}>
        <div style={rowStyle}>
          <div style={leftColStyle}>Status</div>
          <div style={rightColStyle}>
            <div style={{fontWeight: 100, lineHeight:1.5, fontSize:16}}>AppEngine is running on this volume</div>
            <RaisedButton 
              style={{marginTop:16}} 
              label='start' 
              primary={true} 
              disabled={running} 
              onTouchTap={() => daemonStart(volume.uuid)} 
            />
            <RaisedButton 
              style={{marginTop:16, marginLeft:24}} 
              label='stop' 
              secondary={true} 
              disabled={!runningOnMe} 
              onTouchTap={() => daemonStop(volume.uuid)} 
            />
          </div>
        </div>
      </div>

      {/* card text, don't set this container width !!! */}
      <div id='card-text' style={{margin:'16px'}}>
       <div style={rowStyle}>
          <div style={leftColStyle}>Overall Usage</div>
          <div style={rightColStyle}>
            <LabeledText label='data size' text={usage.overall.deviceSize} />
            <LabeledText label='device allocated' text={usage.overall.deviceAllocated} />
            <LabeledText label='device unallocated' text={usage.overall.deviceUnallocated} />
            <LabeledText label='device missing' text={usage.overall.deviceMissing} />
            <LabeledText label='used space' text={usage.overall.used} />
            <LabeledText label='free space (estimated)' text={usage.overall.free} />
            <LabeledText label='free space (minimal)' text={usage.overall.freeMin} />
            <LabeledText label='data ratio' text={usage.overall.dataRatio} />
            <LabeledText label='metadata ratio' text={usage.overall.metadataRatio} />
            <LabeledText label='global reserve (total)' text={usage.overall.globalReserve} />
            <LabeledText label='global reserve (used)' text={usage.overall.globalReserveUsed} />
          </div>
        </div>
        <Spacer />
        <div style={rowStyle}>
          <div style={leftColStyle}>System</div>
          <div style={rightColStyle}>
            <LabeledText label='mode' text={usage.system.mode} />
            <LabeledText label='size' text={usage.system.size} />
            <LabeledText label='used' text={usage.system.used} />
          </div>
        </div>
        <Spacer />
        <div style={rowStyle}>
          <div style={leftColStyle}>Metadata</div>
          <div style={rightColStyle}>
            <LabeledText label='mode' text={usage.metadata.mode} />
            <LabeledText label='size' text={usage.metadata.size} />
            <LabeledText label='used' text={usage.metadata.used} />
          </div>
        </div>
        <Spacer />
        <div style={rowStyle}>
          <div style={leftColStyle}>Data</div>
          <div style={rightColStyle}>
            <LabeledText label='mode' text={usage.data.mode} />
            <LabeledText label='size' text={usage.data.size} />
            <LabeledText label='used' text={usage.data.used} />
          </div>
        </div>
      </div>
    </Paper>
  </div>
  )
}

let renderVolumes = () => {

  let nonavail = renderStorageNonAvail()
  if (nonavail) return nonavail

  let {ports, blocks, volumes, mounts, swaps} = getStore().storage

  return <div>{ volumes.map(volume => renderVolumeRow(volume)) }</div>
}

let buildDiskList = () => {

  let blocks = getStore().storage.blocks

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

let renderDrives = () => {

  return (
    <div>
      <table style={{width: '100%'}}>
        <tbody>
          <tr>
            <td style={{width: '30%', verticalAlign: 'top', fontSize: '36px' }}>hello</td>
            <td style={{verticalAlign: 'top'}}>world</td>
          </tr>
          <tr>
            <td >hello</td>
            <td>world</td>
          </tr>
        </tbody>
      </table>
      { buildDiskList().map((drive) => renderDriveCard(drive)) }   
    </div>
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
        { getStore().storage.mounts.map((mount) => renderMountRow(mount)) }
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
          { getStore().storage.ata_ports.map((port) => renderPortRow(port)) }
        </TableBody>
      </Table>
    </Paper>
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
  Volumes: renderVolumes, 
  Drives: renderDrives, 
  Mounts: renderMounts, 
  Ports: renderATAPorts 
}


