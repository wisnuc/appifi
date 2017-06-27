## Audience

This document is targeted for project developers and contributors.

## Scope

The document includes two parts. The first part clarifies the coding and documentation conventions when using `jsdoc`. The second part briefly describes the `pubsub` pattern used the in the project for communication among modules.

## Conventions

Ideally, using a documentation tool should NOT influence how the developers write code.

In reality, JavaScript is an excessively featured and flexible language. `jsdoc` cannot easily deduce the developer's design or intention correctly merely from grammar or ast. This can be fixed by adding tags but it's tedious.

So choosing `jsdoc`-friendly code pattern is indeed a concern for minimizing the documentation efforts. 

Meanwhile, `jsdoc` has its limitations and pitfalls. They are also taken into account when considering code and comment pattern.

We consider the pattern described in this document as a part of our **coding conventions** for this project. All developers should strictly follow them.

### Stateful and Stateless Module

In JavaScript and Node.js, `module` is synonymous to `component`, which is widely used in software engineering, emphasizing the interface and external interaction or communication for blackbox entities. 

A module is either `stateful` or `stateless`. 

A `stateful` module manages its own states and resources inside. It exports functions to external modules for accessing the states or resources.

A `stateless` module has no internal states, or it has internal states but acts like a pure function with memoization.

### Class-based Singleton Pattern

All `stateful` modules should use the following code and document pattern.

```javascript
/**

@module Something
*/

/**
An example for defining virtual type in jsdoc

@typedef {object} Something
@property {string} name - the name of Something
@property {number} value - the value of Something
*/

module.exports = new class {

  constructor() {

    /**
    @member {object} 
    */
    this.data = undefined

    // call initAsync or init in some way
    // see example in next code section
  }

  /**
  @inner
  @listens oneEvent
  @fires anotherEvent
  */
  async initAsync() {

  }
}

```

### Conventions

+ `@module` tag is used to document a module.
+ `module.exports` is assigned to an anonymous class. If the class must be named for certain reason, it should be named `Singleton`.
+ There is no tag for `module.exports`.
+ There is no tag for `constructor` method. This method won't be shown in rendered document.
+ In `constructor`, all members should be assigned to `undefined` or `null` and be documented. 
+ The `constructor` is used as a initializer rather than a constructor. It runs when loading the module.
+ The anonymous class must have a `initAsync` or `init` function. This function is the REAL constructor. It must be called at the end of constructor.
+ If either `constructor` or `initAsync` function fires or listens to certain events, they should be documented on `initAsync` function. `constructor` is not properly treated for anonymous class in `jsdoc`.
+ When this singleton pattern is used, private methods of the class should be documented with `@inner` tag, not `@private` tag. This keeps the rendered output in consistence with module terminology.

## Benefits and Discussions

First, we don't need to name the class. Usually we use the same name for both module and data type. For example, `User` modules returns a single `user` or a list of `users`.

Though JavaScript has no grammar for explicitly defining a type (duck-typed), it is crucial to clarify the data type in documentation. `jsdoc` allows this by `@typedef` tag.

However, a class is also a type. Which means we have two choices:
+ naming the class as `User`, and the data type as `UserData`, `UserType`, `TUser`, etc.
+ naming the data type as `User`, and the class as `UserManager`, `UserService`, etc.

Both are cumbersome and unfashioned.

Using anonymous class solved this problem. We leave the name to data type, which is concise, straightforward, and intuitive.

Assigning a plain JavaScript object containing members and methods can achieve the same goal. However, we prefer the class grammar for the following reasons:
+ it looks cleaner
+ it is easier to be wrapped and mocked
+ the class can inherit from another one

Second, this pattern forces `jsdoc` to merge all class members and methods into the module page. There is no separate class page. This is convenient since we frequently put some utility or standalone functions in module scope, not class scope, to keep the class code clear and compact.

The drawback is that we lost the ability to document `constructor` function. The workaround is we put all construction job into a separate `init` function and document there.

For standard module without class singleton, `jsdoc` will label all internal member or methods as `inner`, and exported ones as `static`. For named class, `jsdoc` will treat all public members and methods as public, tagless by default. Private members and methods can be tagged with `@private` tag, and rendered with a `private` label.

In our class singleton pattern:
+ members and methods defined in module scope will be `inner`.
+ members and methods in class scope, except the constructor, will be considered `public` and rendered without label.
+ clas members is documented in `constructor` function and merged with module members in rendered output.
+ we can use `@inner` tag to document private class members and methods. Using `@inner` rather than `@private` keep the terminologies in line with module, instead of class.

## Architecture

### Problem

The whole project covers many modules in different feature and resource domains.

+ Some of them must be initialized in certain sequence.
+ For api testing, it's better not to initialize everthing.
+ In future, more and more resources will behave like `observables`.

In this version, all modules are merged into single process and http server. We introduce a pubsub pattern to solve the problems and to be future-proof.

### Pub-Sub

`Broadcast` module acts as a event bus. It inherits from node event emitter. So `on` function is subscription and `emit` is publication.

To avoid splitting results into two different events, such as `error` and `finish`, we use a node callback signature for a single finish events:

```javascript
// on
broadcast.on('SomethingDone`, (err, data) => {})
// emit error
broadcast.emit('SomethingDone', err)
// emit success
broadcast.emit('SomethingDone', null, data)
```

See Broadcast module document for further detail.

## Module Init and Deinit

Inside a module, it listens to events to initialize itself.

If one module must be initialized after others, the former should listen to one or more `PreconditionInitDone` events.

A typical code pattern looks like:

```javascript
module.exports = new class {

  constructor() {



    this.initAsync()
      .then(() => {
        broadcast.emit('SomethingInitDone', null, this.data)
      })
      .catch(e => {
        broadcast.emit('SomethingInitDone', e)
      })

    // hook initialization to SystemDeinit event
    broadcast.on('SystemDeinit', () => {
      this.deinit()
    })
  }

  /**
  @inner
  @listens SystemInit
  @fires SomethingInitDone
  */
  async initAsync() {

    await broadcast.until('Preconditon1InitDone', 'Precondition2InitDone', ...)
  }

  deinit() {
    // do clean up
  }
}
```

It is recommended to use asynchronous function as init for catching all exceptions.

### Actor Model

Initialization and Deinitialization are not the only problem we want to crack. 

Essentially we are slowly evolving the system design to an actor model, which is a extremely powerful model when working in reactive and concurrent system.

An actor model

From outside, an module is an entity fires and listens to events. 

From inside, it is designed and implemented using state machine. All concurrent problems, such as race, asynchronous, queueing/sharing, and throttling can be easily and robustly solved, as well as thoroughly tested.




