import React from 'react'
import { FlatButton, Paper } from 'material-ui'
import { dispatch, timeDateState } from '../utils/storeState'

import { LabeledText } from './CustomViews'

const props = [
  'Local time',
  'Universal time',
  'RTC time',
  'Time zone',
  'NTP synchronized',
  'Network time on'
]

const renderLine = (obj, prop) => <LabeledText label={prop} text={obj[prop] || '(none)'} right={4}/>

const renderTimeDate = (timeDate) => <div>{ props.map(prop => renderLine(timeDate, prop)) }</div>

export default () => (
  <div key='timedate-content-page'>
    <Paper style={{padding:16}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{fontSize:24, opacity:0.87}}>Date and Time</div>
        <FlatButton 
          label='refresh' 
          onTouchTap={() => dispatch({
            type: 'SERVEROP_REQUEST',
            data: {
              operation: 'timeDateUpdate',
            }
          })} 
        />
      </div>
      { timeDateState() && renderTimeDate(timeDateState()) }
    </Paper>
  </div>
  )

