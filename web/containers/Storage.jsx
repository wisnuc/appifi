import React from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import FlipMove from 'react-flip-move'

import { Card, CardTitle, CardHeader, CardText, CardMedia } from 'material-ui/Card'
import { FlatButton, RaisedButton, Avatar, Paper, Divider } from 'material-ui'

import { dispatch, storageStore, storageState, dockerState } from '../utils/storeState'
import { LabeledText, Spacer } from './CustomViews'
import { BouncyCardHeaderLeft, BouncyCardHeaderLeftText } from '../components/bouncy'

/*
 * computed state
 */

const dockerRunning = () => dockerState() !== null

const dockerVolumeBlocks = () => {

  if (!dockerState()) return []

  let running = storageState().volumes.find(v => v.uuid === dockerState().volume)
  if (!running) return []

  return running.devices.map(dev => dev.path)
}

const volumeMountpoint = (volume) => {

  let { mounts } = storageState()
  if (mounts === null) return null
  let m = mounts.find(mnt => volume.devices.find(dev => dev.path === mnt.device))
  if (m === undefined) return null
  return m.mountpoint
}

// drive is an object
// {
//    block: -> refer to block 
//    children: -> array of sub block device, sorted by name (eg, sda1)
// }
//
// this function returns an array of drives, sorted by name (eg sda)
//
const buildDrives = () => {

  let blocks = storageState().blocks 
  let disks = blocks .filter(block => block.props.devtype === 'disk')
              .map(block => {
                return { block, children:[] }
              })

  disks.forEach((disk) => {
    blocks.forEach((block) => {
      if (block.props.devtype === 'partition' && block.path.startsWith(disk.block.path)) {
        disk.children.push(block)
      }
    })

    disk.children.sort((a, b) => a.name.localeCompare(b.name))
  })

  disks.sort((a, b) => a.block.name.localeCompare(b.block.name))
  return disks
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

const driveIsInDockerVolume = (drive) => !!dockerVolumeBlocks().find(blk => blk === drive.block.props.devname)

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

  if (driveIsInDockerVolume(drive))
    return 'drive is in the volume running AppEngine'

  return null
}

// using devname as key
const driveKey = (drive) => drive.block.props.devname

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

  return finished
}

let renderVolumeCard = (volume) => {

  let { ports, blocks, volumes, mounts, swaps, usages } = storageState()
  let docker = dockerState()

  let { request } = storageStore()

  console.log('>>>>')
  console.log(request)
  console.log('<<<<')

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
    dispatch({ 
      type: 'DOCKER_OPERATION',
      operation: { 
        operation: 'daemonStart',
        args: [uuid]
      }
    })
  }

  let daemonStop = (uuid) => {
    dispatch({
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

  let shrinkedCardStyle = { width: '100%', marginTop: 0, marginBottom: 0 }
  let expandedCardStyle = { width: '100%', marginTop: 24, marginBottom: 24 }


  return (
    <div key={volume.uuid}>
      <Paper style={expanded ? expandedCardStyle : shrinkedCardStyle} zDepth={expanded ? 2 : 1}>
        <div style={{display:'flex', alignItems: 'center'}} >
          <BouncyCardHeaderLeft title='btrfs' onClick={volumeCardOnClick}>
            <BouncyCardHeaderLeftText text={bannerText()} />
          </BouncyCardHeaderLeft>
          <div>
            <RaisedButton style={{marginRight:16}} label='start' primary={true} 
              disabled={running || storageStore().creatingVolume !== 0} 
              onTouchTap={() => daemonStart(volume.uuid)} />
            <RaisedButton style={{marginRight:16}} label='stop' secondary={true} 
              disabled={!runningOnMe || storageStore().creatingVolume !== 0} 
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
              <LabeledText label='mount point' text={volumeMountpoint(volume)} right={2}/>
            </div>
          </div>
        </div>
        <Divider />
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Usage</div>
            { (usage && usage.overall) ? (
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
              <LabeledText label='mode' text={(usage && usage.system) ? usage.system.mode : 'n/a'} right={2} />
              <LabeledText label='size' text={(usage && usage.system) ? usage.system.size : 'n/a'} right={2} />
              <LabeledText label='used' text={(usage && usage.system) ? usage.system.used : 'n/a'} right={2} />
            </div>
          </div>
        </div>
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Metadata</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='mode' text={(usage && usage.metadata) ? usage.metadata.mode : 'n/a'} right={2} />
              <LabeledText label='size' text={(usage && usage.metadata) ? usage.metadata.size : 'n/a'} right={2} />
              <LabeledText label='used' text={(usage && usage.metadata) ? usage.metadata.used : 'n/a'} right={2} />
            </div>
          </div>
        </div>
        <div>
          <div style={{display:'flex'}}>
            <div style={{width:56}} /> 
            <div style={{paddingTop:16, paddingBottom:16, width:200,
              fontSize:16, fontWeight:'bold', opacity:0.54}}>Data</div>
            <div style={{paddingTop:16, paddingBottom:16, flex:3}}>
              <LabeledText label='mode' text={(usage && usage.data) ? usage.data.mode : 'n/a'} right={2} />
              <LabeledText label='size' text={(usage && usage.data) ? usage.data.size : 'n/a'} right={2} />
              <LabeledText label='used' text={(usage && usage.data) ? usage.data.used : 'n/a'} right={2} />
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
    return <div>{`${storage.name}: ${storage.message}`}, retry please</div>
  }

  let {ports, blocks, volumes, mounts, swaps} = storage

  if (volumes && volumes.length) {
    return <div>{ volumes.map(volume => renderVolumeCard(volume)) }</div>
  }

  return <div>no volumes detected, please create a volume.</div>
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

const renderDriveCardHeader = (drive) => {

  const onClick = () => dispatch({ type: 'STORAGE_CARD_EXPANSION_TOGGLE', data: { type: 'drive', id: driveKey(drive) } }) 
  const removeButtonOnTouchTap = () => dispatch({ type: 'STORAGE_REMOVE_NEW_VOLUME_CANDIDATE', data: driveKey(drive) })
  const addButtonOnTouchTap =  () => dispatch({ type: 'STORAGE_ADD_NEW_VOLUME_CANDIDATE', data: driveKey(drive) })

  let { creatingVolume } = storageStore()
  let middleText

  let disallowedText = driveIsAllowedForNewVolumeCandidate(drive) 
  let disallowed = disallowedText !== null
  if (creatingVolume) {
    middleText = disallowed ? 'This drive can not be added to new volume, ' + disallowedText : 'This drive can be added to new volume'
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

const renderDriveCard = (drive) => {

  let deselected = { width: '100%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 16, marginBottom: 16 }

  let expanded = driveExpanded(drive)

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

let renderNonCandidateDrives = () => {

  let drives = buildDrives()
  let filtered = drives.filter(drive => 
    !storageStore().newVolumeCandidates.find(candi => candi === driveKey(drive))) 

  return filtered.map(drive => renderDriveCard(drive))
}

let renderCandidateDrives = () => {

  let drives = buildDrives()

  let filtered = []

  storageStore().newVolumeCandidates.forEach(candi => {
    let drive = drives.find(d => driveKey(d) === candi)
    if (drive) filtered.push(drive)
  })

  return filtered.map(drive => renderDriveCard(drive))
}

let renderAll = () => {

  let {creatingVolume, newVolumeCandidates} = storageStore()

  let containerStyle = {
    zIndex: -1
  }

  let creatingVolumeStyle = Object.assign({}, containerStyle, {
    backgroundColor:'#DDDDDD',
    padding:16,
    transition: 'all 300ms ease 300ms'
  })

  let nonCreatingVolumeStyle = Object.assign({}, containerStyle, {
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

  let showSingleButton = creatingVolume === 2 && newVolumeCandidates.length > 0
  let singleButtonOnTouchTap = () => dispatch({
    type: 'STORAGE_OPERATION',
    data: {
      operation: 'mkfs_btrfs',
      args: [{
        mode: 'single',
        blknames: storageStore().newVolumeCandidates
      }]
    }
  })
  
  let showRaid0Button = creatingVolume === 2 && newVolumeCandidates.length > 1
  let raid0ButtonOnTouchTap = () => dispatch({
    type: 'STORAGE_OPERATION',
    data: {
      operation: 'mkfs_btrfs',
      args: [{
        mode: 'raid0',
        blknames: storageStore().newVolumeCandidates 
      }]
    }
  })

  let showRaid1Button = creatingVolume === 2 && newVolumeCandidates.length > 1
  let raid1ButtonOnTouchTap = () => dispatch({
    type: 'STORAGE_OPERATION',
    data: {
      operation: 'mkfs_btrfs',
      args: [{
        mode: 'raid1',
        blknames: storageStore().newVolumeCandidates
      }]
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

          { showRaid1Button && <div><RaisedButton style={{marginRight:16}} label='create raid1 volume' secondary={true} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={raid1ButtonOnTouchTap} /></div> }
          { showRaid0Button && <div><RaisedButton style={{marginRight:16}} label='create raid0 volume' secondary={true} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={raid0ButtonOnTouchTap} /></div> }
          { showSingleButton && <div><RaisedButton style={{marginRight:16}} label='create single volume' secondary={true} 
            disabled={creatingVolumeSubmitted() || creatingVolumeFinished() } onTouchTap={singleButtonOnTouchTap} /></div> }         

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

export default { 

  Volumes: renderAll,
}


