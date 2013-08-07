
/* 
* Copyright (c) 2012 Kaerus (kaerus.com), Anders Elo <anders @ kaerus com>.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var root;

try{root = global} catch(e){try {root = window} catch(e){root = this}}

var setImmediate = root.setImmediate;

if(!setImmediate){
    if(root.process && typeof root.process.nextTick === 'function') {
        setImmediate = root.process.nextTick;
    } else if (root.MessageChannel && typeof root.MessageChannel === "function") {
        var fifo = [], channel = new root.MessageChannel();
        channel.port1.onmessage = function () { fifo.shift()() };
        setImmediate = function (task){ fifo[fifo.length] = task; channel.port2.postMessage(); };
    } else if(root.setTimeout) {
        setImmediate = root.setTimeout;
    } else throw Error("No candidate for setImmediate");  
} 

var PROMISE = 0, FULFILLED = 1, REJECTED = 2;

function Promise(resolver) {

    if(!(this instanceof Promise))
        return new Promise(resolver);

    Object.defineProperty(this,'calls',{
        enumerable: false,
        writable: false,
        value: []
    });

    if(resolver){
        var resolve = Resolver.bind(this);

        if(typeof resolver !== 'function') 
            throw TypeError("Promise resolver must be a function");

        try {
            var value = resolver(resolve);
            if(value !== undefined) resolve.fulfill(value);
        } catch (error) {
            if(error instanceof Error)
                console.log("Resolver error:", error.stack||error);

            /* catched rejection */ 
            resolve.reject(error);
        }    

    }    
}

function Resolver(){}       

Promise.prototype.resolve = function() {
    var then, promise, res,
        state = this.state,
        value = this.value;

    if(!state) return;

    while(then = this.calls.shift()) {
        promise = then[PROMISE];

        if(typeof then[state] === 'function') {
            try {
                value = then[state].call(promise,this.value);  
            } catch(error) {
                if(promise.catch) promise.catch(error,this.value);
                else promise.reject(error); 

            }  

            if(value instanceof Promise || (value && typeof value.then === 'function') )  {
                /* assume value is thenable */
                value.then(function(v){
                    promise.fulfill(v); 
                }, function(r){
                    promise.reject(r);
                });
            } else promise.fulfill(value);   
        } else {
            if(state === FULFILLED)
                promise.fulfill(value);
            else 
                promise.reject(value);
        }
    }
}

Promise.prototype.fulfill = function(value) {
    if(this.state) return;

    if(arguments.length > 1)
        value = [].slice.call(arguments);

    this.state = FULFILLED;
    this.value = value;

    this.resolve();
}

Promise.prototype.reject = function(reason) {
    if(this.state) return;

    this.state = REJECTED;
    this.value = reason;

    this.resolve();
}

Promise.prototype.then = function(onFulfill,onReject) {
    var self = this, promise = new Promise();

    this.calls[this.calls.length] = [promise, onFulfill, onReject];

    if(this.state) {
        setImmediate(function(){
            self.resolve();
        });
    }    

    return promise;
}

Promise.prototype.spread = function(onFulfill,onReject) {

    function spreadFulfill(value) {
        if(!Array.isArray(value)) 
            value = [value];

        return onFulfill.apply(null,value);
    }   

    return this.then(spreadFulfill,onReject);
}

/* Helper for deferring a function/process */
function defer(promise,proc) {
    var value;

    if(proc instanceof Promise || (proc && typeof proc.then === 'function')){
        /* If proc is a promise, then wait for fulfillment */
        proc.then(function(value) {
            promise.fulfill(value);
        }, function(reason) {
            promise.reject(reason);
        });
    } else {
        setImmediate(function(){
            try {
                value = proc.call(promise);
                /* proc can resolve the promise itself */
                /* in which case fullfill gets ignored */
                promise.fulfill(value);
            } catch (e) {
                promise.reject(e);
            }
        });
    }    
    
    return promise;    
}

/* defers and resolves a function/process */
Promise.prototype.defer = function(proc){
    return defer(this,proc);
}

/* Allows us to defer & join tasks.            */
/* var tasks = [func1,func2,func3];            */
/* Promise.when(tasks)                         */
/*    .spread(function(ret1,ret2,ret3){...});  */   
Promise.prototype.when = function(task) {
    var promise, last = promise = this, values = [];

    /* Single task */
    if(!Array.isArray(task)) 
        return this.defer(task);

    function deferred(promised,i) {
        defer(promised,task[i]).then(function(v) {
            values[i] = v; 
        });

        return function(){return promised}
    }

    for(var i = 0; i < task.length; i++) {
        promise = last;
        last = promise.then(deferred(promise,i));
    }
    /* return the collected fulfillment values */
    return promise.then(function(){return values});
} 

/* Attaches a handle (typically) to the promiser.   */
/* In an Ajax scenario this could be the xhr object */ 
Promise.prototype.attach = function(handle) {
    Object.defineProperty(this,'attached',{
        enumerable:false,
        value: handle
    });

    return this;
}

/* Aborts and notifies attached process (originator) */
Promise.prototype.abort = function(message) {
    if(this.attached && typeof this.attached.abort === 'function') 
        this.attached.abort();

    this.reject(message);

    return this;
}

Promise.prototype.timeout = function(time,func) {
    /* null cancels timeout */
    if(time === null) {
        clearTimeout(this._timer);
        return this;
    } 
    
    /* fulfilled or rejected */
    if(this._state) return this;

    /* trigger abort on timeout */
    if(!func) func = function() {
        this.abort("timed out");
    }
    
    this._timer = setTimeout(func.bind(this),time);   

    return this;
}

module.exports = Promise;