<a href="http://promises-aplus.github.com/promises-spec">
    <img src="http://promises-aplus.github.io/promises-spec/assets/logo-small.png"
         align="right" alt="Promises/A+ logo" />
</a>
[![Build Status](https://travis-ci.org/kaerus-component/promise.png)](https://travis-ci.org/kaerus-component/promise)

Promise.js
==========
Providing A+ compliant promises with some extras. Based on [microPromise (uP)](https://github.com/kaerus-component/uP)

  - [Promise.async()](#promiseasync)
  - [Promise.async2()](#promiseasync2)
  - [Promise.join()](#promisejoinpromisesarray)
  - [Promise.wrap()](#promisewrapprotoobject)
  - [Promise.spread()](#promisespreadonfulfillfunctiononrejectfunction)
  - [Promise.timeout()](#promisetimeouttimenumbercallbackfunction)

## Promise.async()

  Makes a process/function asynchronous.
  The process may also return a promise itself which to wait on.
  If the process returns undefined the promise will remain pending.  
  
  Example: Make readFileSync async
```js
   fs = require('fs');
   var asyncReadFile = p.async(fs.readFileSync,'./index.js');
   asyncReadFile.then(function(data){
       console.log(data.toString())
   },function(error){
       console.log("Read error:", error);
   });
```

## Promise.async2()

  Adapted for processes expecting a callback(err,ret). 
  
  Example: make readFile async
```js
   fs = require('fs');
   var asyncReadFile = p.async2(fs.readFile,'./index.js');
   asyncReadFile.then(function(data){
       console.log(data.toString())
   },function(error){
       console.log("Read error:", error);
   });
```

## Promise.join(promises:Array)

  Joins promises and assembles return values into an array.
  If any of the promises rejects the rejection handler is called with the error.  
  
  Example: join two promises
```js
   p = Promise();
   a = Promise();
   b = Promise();
   p.join([a,b]).spread(function(x,y){
       console.log('a=%s, b=%s',x,y);
   },function(err){
       console.log('error=',e);
   });
   b.fulfill('world');
   a.fulfill('hello'); // => 'a=hello, b=world' 
   p.resolved; // => ['hello','world']
```

## Promise.wrap(proto:Object)

  Wraps a `proto`
  
  Example: wrap an Array
```js
   p = Promise();
   c = p.wrap(Array);
   c(1,2,3); // => calls constructor and fulfills promise 
   p.resolved; // => [1,2,3]
```

## Promise.spread(onFulfill:Function, onReject:Function)

  Spread has the same semantic as then() but splits multiple fulfillment values into separate arguments  
  
  Example: Fulfillment array elements as arguments
```js
   var p = Promise();
   p.fulfill([1,2,3]).spread(function(a,b,c){
       console.log(a,b,c); // => '1 2 3'
   });
```

## Promise.timeout(time:Number, callback:Function)

  Timeout a pending promise and invoke callback function on timeout.
  Without a callback it throws a RangeError('exceeded timeout').
  
  Example: timeout & abort()
```js
   var p = Promise();
   p.attach({abort:function(msg){console.log('Aborted:',msg)}});
   p.timeout(5000);
   // ... after 5 secs ... => Aborted: |RangeError: 'exceeded timeout']
```

  Example: cancel timeout
```js
   p.timeout(5000);
   p.timeout(null); // timeout cancelled
```


License
=======
```
Copyright (c) 2012 Kaerus (kaerus.com), Anders Elo <anders @ kaerus com>.
```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
 
    http://www.apache.org/licenses/LICENSE-2.0
 
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.