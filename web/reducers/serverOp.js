import request from 'superagent'

/*
  action definition

  action.type
  action.data: {
    endpoint ???
    post: {
    }
  }

  serverop store: [
    {
      endpoint: url
      post: {
      },

      timeout: for scheduled
      request: request

      errno: 
      message: 
      res: 
    },
    ...
  ]
*/
 

const reducer = (state = [], action) => {

  switch(action.type) {
  case 'SERVEROP_REQUEST': {

    if (state.timeout || state.request) {
      return state
    }

    return {

      endpoint: 
      post: {
        operation:        
        args: [] 
      },

      timeout: null,
      request: request
        .post(endpoint)
        .send(action.data)
        .end((err, res) => dispatch({
          type: 'OPERATION_RESPONSE', 
          err, res})),

      errno: 0,
      message: null,
      response: null,
      data: action.data
    }
  }

  case 'SERVEROP_RESPONSE': {
    
    let errno = action.err ? action.err.errno : 0
    let message = action.err ? action.err.message : null
    let response = action.err ? null : action.res

    return {
      timeout: null,
      request: null,
      errno, 
      message, 
      response,
      
    }
  }

  default:
    return state
  }
}

export default reducer

