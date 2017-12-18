let arr = [0, 1, 2, 3]

// find the first value in array x that equals to y
// return index, or null if not found
const find1 = (x, y) => {
  for (let i = 0; i < x.length; i++) {
    if (x[i] === y)
      return i
  }
  return null
}

console.log(find1(arr, 2))
console.log(find1(arr, 5))

// the functional programming version
const find2 = (f => f(f))(f => 
  (next => (x, y, i = 0) => 
    (i >= x.length) ? null : (x[i] === y) ? i : 
      next(x, y, i+1))((...args) => 
        (f(f))(...args)))

console.log(find2(arr, 2))
console.log(find2(arr, 5))

const Y = fx => (f=>f(f))(f=>fx((...args)=>f(f)(...args)))

const find3 = next => (x, y, i = 0) => {
  if (i >= x.length) return null
  if (x[i] === y) return i
  return next(x, y, i+1)
}

console.log(Y(find3)(arr, 2))
console.log(Y(find3)(arr, 5))

const fact = next => (n) => {
  if (n === 1) return 1
  return next(n - 1) * n
}

console.log(Y(fact)(5))

const fib = next => (n) => {
  if (n === 1) return 1 
  return next(n - 1) + n
}

console.log(Y(fib)(5))

