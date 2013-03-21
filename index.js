
try { window } catch (e) { window = global }

/* setImmediate shim */
var setImmediate = window.setImmediate;

if(typeof setImmediate !== 'function') {
    if(typeof window.MessageChannel !== "undefined") {
        var fifo = [], channel = new window.MessageChannel();
        channel.port1.onmessage = function () { fifo.shift()() };
        setImmediate = function (task) { fifo[fifo.length] = task; channel.port2.postMessage(); };
    } else if(typeof window.setTimeout === 'function') {
        setImmediate = window.setTimeout;
    } else throw "No candidate for setImmediate";   
}

var PENDING = 0, FULFILLED = 1, REJECTED = 2;

function Promise(obj) {
    /* mixin */
    if(obj){
        for(var key in Promise.prototype)
            obj[key] = Promise.prototype[key];
        
        return obj;
    }

    if(!(this instanceof Promise))
        return new Promise;
}

Promise.prototype.resolve = function() {
    var then, promise,
        state = this._state,
        value = this.resolved;   
            
    while(then = this._calls.shift()) {
        promise = then[PENDING];

        if(typeof then[this._state] === 'function') {
            try {
                /* Call handler with this Promise */
                value = then[this._state].call(this,this.resolved);    
            } catch(e) {
                /* reject if handler throws */
                promise.reject(e); 

                continue;   
            }    
            if(value instanceof Promise || (value && typeof value.then === 'function') )  {
            
                value.then(function(v){
                    promise.fulfill(v); 
                }, function(r){
                    promise.reject(r);
                });

                continue;
            } else {
                /* A+ spec section 7.1 */  
                state = FULFILLED;
            }  
        } 
        promise._state = state;
        promise.resolved = value;
        if(promise._calls) promise.resolve();   
    }  
} 

Promise.prototype.then = function(onFulfill,onReject) {
    var self = this, promise = new Promise();

    if(!this._calls) this._calls = [];   

    this._calls[this._calls.length] = [promise, onFulfill, onReject];

    if(this.resolved) {
        setImmediate(function(){
            self.resolve();
        });
    }  

    return promise;
}

Promise.prototype.spread = function(onFulfill,onReject) {
    var self = this;

    function spreadFulfill(value) {
        if(!Array.isArray(value)) 
            value = [value];

        return onFulfill.apply(self,value);
    }   

    return this.then(spreadFulfill,onReject);
}

Promise.prototype.fulfill = function(value) {
    if(this._state) return;
    /* Constructs an array of fulfillment values */
    /* if more than one argument was provided... */
    if(arguments.length > 1) 
        value = [].slice.call(arguments);

    this._state = FULFILLED;
    this.resolved = value;

    if(this._timer) clearTimeout(this._timer);
    if(this._calls) this.resolve();

    return this;
}

Promise.prototype.reject = function(reason) {
    if(this._state) return;

    this._state = REJECTED;
    this.resolved = reason;

    if(this._timer) clearTimeout(this._timer);
    if(this._calls) this.resolve();   

    return this;        
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
    this.attached = handle;

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