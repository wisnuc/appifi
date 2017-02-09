## Paradigm Shift

It should be mentioned that the `waterwheel` design is a paradigm shift for both host and guests.

When constructing a control flow thread (eg. a function or procedure), the high level unit (eg. a function) usually holds some states and the low level execution unit holds their own. They collaborate via contract (function definition).

This isn't too hard if most resources are local and can be reliably accessed in most case, just as most programs do.

However, if the high level execution unit and low level one resides on different entities on network, things get a big harder, but not too hard.

Most blocking access to local resources change to remote access. In some case, this may influence language construct or library design, say, callbacks or promises in JavaScript.

Though we frequently say `asynchronous` in concurrent programming context, the fundamental thing does not changed. i.e., the programmer still construct (the collaborative) actions in the thread mental model.

For example, a http request has request and response. You trigger the request and waiting for response, either success or failure. In most cases, the request initializer holds a bunch of local state, which is necessary to continue the process. The state are essentially maintained in each party involved in the process.

**Multi-party** state maintenance is the nightmare of networked or distributed collaboration. Since every party can break down or malfunction, it is very hard to recover from disaster.

The successful design should switch to `Actor Model`, in which, the message passing just confirms if the message is successfully delivered, rather than the job described by the message is successfully fulfilled.

If http is used as message passing protocol, the server returns only if the request or response are accepted. Hence, for the request initializer, the http 200 success means the job description is accepted (queued), rather than it is fulfilled.

`waterwheel` maintained a purely descriptive data structure to be CRUDed by both requester (guest) and responder (host). In other words, it is `waterwhell's` responsibility to maintain the **COMPLETE STATES** of the collaborative action. As long as `waterwheel` instance correctly maintains and persists the **COMPLETE STATES**, the process can survive break-down or reboot cycle from **ANY PARTIES**.
