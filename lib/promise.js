'use strict'

let h = new Promise((res, rej) => { 
  console.log('hello')
  res(5) 
})

h.then((val) => console.log(val))


