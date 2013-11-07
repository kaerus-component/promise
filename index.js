var uP = require('uP');

(function(root){
    "use strict";

    function Promise(obj){
        if(!(this instanceof Promise))
            return new Promise(obj);

        for(var key in obj){
            this[key] = obj[key];
        }

        return uP(this);
    }

    /**
     * Makes a process/function asynchronous.
     * The process may also return a promise itself which to wait on.
     * If the process returns undefined the promise will remain pending.  
     * 
     * Example: Make readFileSync async
     *      fs = require('fs');
     *      var asyncReadFile = p.async(fs.readFileSync,'./index.js');
     *      asyncReadFile.then(function(data){
     *          console.log(data.toString())
     *      },function(error){
     *          console.log("Read error:", error);
     *      });
     *         
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.async = function(){
        var args = Array.prototype.slice.call(arguments),
            proc = args.shift();

        this.defer(function(){
            proc.apply(null,args);
        });

        return this;
    };

    /**
     * Adapted for processes expecting a callback(err,ret). 
     * 
     * Example: make readFile async
     *      fs = require('fs');
     *      var asyncReadFile = p.async2(fs.readFile,'./index.js');
     *      asyncReadFile.then(function(data){
     *          console.log(data.toString())
     *      },function(error){
     *          console.log("Read error:", error);
     *      });
     *         
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.async2 = function(){
        var self = this,
            args = Array.prototype.slice.call(arguments);

        function callback(err,ret){ if(!e) self.fulfill(ret); else self.reject(ret); }

        args[args.length] = callback;

        return this.async.apply(this,args);
    };

    /**
     * Joins promises and assembles return values into an array.
     * If any of the promises rejects the rejection handler is called with the error.  
     * 
     * Example: join two promises
     *      p = Promise();
     *      a = Promise();
     *      b = Promise();
     *      p.join([a,b]).spread(function(x,y){
     *          console.log('a=%s, b=%s',x,y);
     *      },function(err){
     *          console.log('error=',e);
     *      });
     *      b.fulfill('world');
     *      a.fulfill('hello'); // => 'a=hello, b=world' 
     *      p.resolved; // => ['hello','world']
     *
     * @param {Array} promises
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.join = function(promises){
        var val = [], 
            promise = this, 
            chain = uP().fulfill();

        if( arguments.length > 1) {
            promises = Array.prototype.slice.call(arguments);
        }

        if(!Array.isArray(promises)) promises = [promises];

        function collect(i){
            promises[i].then(function(v){
                val[i] = v;
            });

            return function(){return promises[i]}    
        }

        for(var i = 0, l = promises.length; i < l; i++){
            chain = chain.then(collect(i));
        }

        chain.then(function(){promise.fulfill(val)},function(e){promise.reject(e)});

        return this;
    };

    /**
     * Wraps a `proto`
     * 
     * Example: wrap an Array
     *      p = Promise();
     *      c = p.wrap(Array);
     *      c(1,2,3); // => calls constructor and fulfills promise 
     *      p.resolved; // => [1,2,3]
     *
     * @param {Object} proto
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.wrap = function(proto){
        var promise = this;

        return function(){
            var args = Array.prototype.slice.call(arguments), ret;

            if(proto instanceof Promise){
                proto.fulfill(args).then(promise.fulfill,promise.reject);
            } else if(typeof proto === 'function'){
                try{
                    ret = proto.apply(promise,args);
                    if(promise.isPending) promise.fulfill(ret);
                } catch(err) {
                    promise.reject(err);
                }
            }
                
            return promise;
        }              
    };

    /**
     * Spread has the same semantic as then() but splits multiple fulfillment values into separate arguments  
     * 
     * Example: Fulfillment array elements as arguments
     *      var p = Promise();
     *      p.fulfill([1,2,3]).spread(function(a,b,c){
     *          console.log(a,b,c); // => '1 2 3'
     *      });     
     *      
     * @param {Function} onFulfill
     * @param {Function} onReject  
     * @return {Object} promise for chaining
     * @api public
     */
    Promise.prototype.spread = function(f,r,n){  
        function s(v){
            if(!Array.isArray(v)) v = [v];
            return f.apply(f,v); 
        }

        return this.then(s,r,n);
    };

    /**
     * Timeout a pending promise and invoke callback function on timeout.
     * Without a callback it throws a RangeError('exceeded timeout').
     *
     * Example: timeout & abort()
     *      var p = Promise();
     *      p.attach({abort:function(msg){console.log('Aborted:',msg)}});
     *      p.timeout(5000);
     *      // ... after 5 secs ... => Aborted: |RangeError: 'exceeded timeout']
     *      
     * Example: cancel timeout
     *      p.timeout(5000);
     *      p.timeout(null); // timeout cancelled
     *            
     * @param {Number} time timeout value in ms or null to clear timeout
     * @param {Function} callback optional timeout function callback
     * @throws {RangeError} If exceeded timeout  
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.timeout = function(t,ontimeout){
        var promise = this;

        if(t === null) {
            clearTimeout(promise.timer);
            promise.timer = null;
        } else if(!promise.timer){             
            promise.timer = setTimeout(t,timeoutHandler);
        }       

        function timeoutHandler(){ 
            if(promise.isPending) {
                if(typeof ontimeout === 'function') ontimeout(promise);
                else throw RangeError("exceeded timeout");
            } 
        }

        return this;
    };

    try { root = global } catch(e) { try { root = window } catch(e) {} }

    if(module && module.exports) module.exports = Promise;
    else if(typeof define ==='function' && define.amd) define(Promise); 
    else root.Promise = Promise; 
}(this));