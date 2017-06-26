# About the Document

This document is targeted for project developers and contributors.

The first part clarifies the code and document conventions when using `jsdoc`. The second part describes the pub-sub pattern used for module initialization and testing.

# Conventions

Theoretically, using a documentation tool should NOT change the code pattern at all. 

In reality, JavaScript is an excessively featured and flexible language. There are always several ways to fulfill a job. In certain cases, `jsdoc` cannot deduce the developer's design or intention correctly. These can be fixed by manually adding tags everywhere to tell `jsdoc` the truth, but it's tedious and should be avoided. Choosing `jsdoc`-friendly code pattern will minimize the documentation. Also, `jsdoc` has its limitations and pitfalls. They shoud also be taken into account when choosing code and document pattern.

We consider the code and document pattern described in this document as a part of our **coding conventions** for this project. All developers should strictly follow them.

## Stateful and Stateless Module

A module is either `stateful` or `stateless`. 

A `stateful` module manages its own states and resources inside. It exports functions to external modules for accessing the states or resources.

A `stateless` module has no internal states, or it has internal states but acts like a pure function with memoization.

## Class and Singleton Pattern

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

## Conventions

+ `@module` tag is used to document a module.
+ `module.exports` is assigned to an anonymous class. If the class must be named for certain reason, it should be named `Singleton`.
+ There is no tag for `module.exports`.
+ There is no tag for `constructor` method. This method won't be shown in rendered documents.
+ In `constructor`, all members should be assigned to `undefined` or `null`. It is used as a initializer, rather than a constrcutor.
+ The anonymous class must have a `initAsync` or `init` function. This function is the REAL constructor. It must be called at the end of constructor.
+ If either `constructor` or `initAsync` function fires or listens certain events, they are both documented on `initAsync` function. `constructor` is not properly treated for anonymous class in `jsdoc`.
+ When this singleton pattern is used, private methods of the class should be documented with `@inner` tag, not `@private` tag.

## Benefits and Discussions

First, we don't need to name the class. Usually we use the same name for both module and data type. For example, `User` modules returns a single user object or a list of user objects.

`jsdoc` follows a tranditional rules in programming languages with type system: a class is a type. Therefore they have the same namespace.

Using anonymous class reserves the name to be defined as a virtual data type using `@typedef` tag, which is intuitive, concise and straightforward.

Second, this pattern forces `jsdoc` to merge all class members and methods into the module page. There is no separate class page. This is convenient since we frequently put some utility or standalone functions in module scope, not class scope, to keep the class code concise and compact. 



The drawback is that we lost the ability to document `constructor` function. The workaround is we put all construction job into a separate `init` function and document there.

All internal (module) function will be automatically tagged as `inner`. This is also a good feature. For class method, they are `public` by default. If it is an internal function, we can put a `@inner` tag in document. `jsdoc` has `@private` tag for this purpose. But here, though class is used, our intention is to implement a module with Singleton pattern, so `@inner` tag is more appropriate.

# Architecture

## Problem

The whole project covers many modules in different feature and resource domains. During start-up, they must be carefully initialized in appropriate sequence. If the production deployment is the only concern, we can fulfill the job by a single, lengthy init function. If the module testing is taken into account, however, we need to write lots of init functions for different test groups. And even worse, they are fragile to design change.

In this version, we merge all modules into single process and http server. So for api testing, all modules will be loaded into memory even most of them is not under testing for a single test group. The unnecessary initialization should be avoided.

We crack the problem by two design decisions:

First, all stateful modules must implement a `deinit` to clean up everything. 

Second, a global event bus is introduced. All modules can act as event listeners during initialzation. This allows us to inject fake event to trigger initialization of certain component, bypassing irrelevent pre-conditions.

## Broadcast

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

## Initialization

For system-wide initialization, the top level `App` module fires a `SystemInit` event after all modules loaded.

If one module must be initialized before another one, the former should defer its initialization until `SystemInit` and fire a `XxxxInitDone` event when finished. The latter can listen to this event for starting its own initialization. And so on. If a module is absolutely sure that there is no other module depending on it, it can start initialization when loaded, without waiting for `SystemInit`.

A typical code pattern looks like:

```javascript
module.exports = new class {

  constructor() {


    // hook initialization to SystemInit event
    broadcast.on('SystemInit', () => {
      this.initAsync()
        .then(() => {
          broadcast.emit('SomethingInitDone', null, this.data)
        })
        .catch(e => {
          broadcast.emit('SomethingInitDone', e)
        })
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

  }

  deinit() {
    // do clean up
  }
}
```

It is recommended to use asynchronous function as init for catching all exceptions.
