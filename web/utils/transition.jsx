import React from 'react'
import Transition from 'react-addons-css-transition-group'

export default ({opts, children}) => {

  if (!Array.isArray(opts)) {
    throw new Error('opts must be array')
  }

  if (opts.length !== 7) {
    throw new Error('opts must contains exactly 7 elements')
  }

  let t = opts;

  return (
   <Transition
      transitionName={t[0]}
      transitionAppear={t[1]}
      transitionEnter={t[2]}
      transitionLeave={t[3]}
      transitionAppearTimeout={t[4]}
      transitionEnterTimeout={t[5]}
      transitionLeaveTimeout={t[6]}
      component='div'
    >
      { children }
    </Transition>     
  )
}

