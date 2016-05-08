
export const store = () => window.store
export const dispatch = (action) => window.store.dispatch(action)
export const mixin = (state, obj) => Object.assign({}, state, obj)

export default { dispatch, mixin }

