
var uP = require('uP');

(function(){
    
    function isPromise(f) {
        return f && typeof f.then === 'function';
    }

    function Promise(){
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
        var self = this,
            args = Array.prototype.slice.call(arguments),
            proc = args.shift(),
            ret;

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
     *      b.fulfill('hello');
     *      a.fulfill('world'); // => 'a=hello, b=world' 
     *      p.resolved; // => ['hello','world']
     *
     * @param {Array} promises
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.join = function(promises){
        var val = [], 
            self = this, 
            chain = uP().fulfill();

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

        chain.then(function(){self.fulfill(val)},function(e){self.reject(e)});

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
        var self = this;

        return function(){
            var args = Array.prototype.slice.call(arguments), ret;

            if(isPromise(proto)){
                proto.fulfill(args).then(self.fulfill,self.reject);
            } else if(typeof proto === 'function'){
                try{
                    ret = proto.apply(null,args);
                    self.fulfill(ret);
                } catch(err) {
                    self.reject(err);
                }
            }
                
            return self;
        }              
    };

    /**
     * Spread has the same semantic as then() but splits multiple fulfillment values into separate arguments  
     * 
     * Example: Fulfillment array elements as arguments
     *      var p = uP();
     *      p.fulfill([1,2,3]).spread(function(a,b,c){
     *          console.log(a,b,c); // => 123
     *      });     
     *      
     * @param {Function} onFulfill
     * @param {Function} onReject  
     * @return {Object} promise for chaining
     * @api public
     */
    Promise.prototype.spread = function(f,r){    
        function s(v){
            if(!Array.isArray(v)) v = [v];
            return f.apply(this,v); 
        }

        return this.then(s,r);
    };

    /**
     * Timeout a pending promise and invoke callback function on timeout.
     * Without a callback it throws a RangeError('exceeded timeout').
     * 
     * @param {Number} time timeout value in ms or null to clear timeout
     * @param {Function} callback optional timeout function callback
     * @throws {RangeError} If exceeded timeout  
     * @return {Object} promise
     * @api public
     */
    Promise.prototype.timeout = function(t,f){
        var self = this;

        if(t === null) {
            clearTimeout(this.timer);
            this.timer = null;
        } else if(!this.timer){
            if(typeof f !== 'function'){
                f = function(){ 
                    if(self.status ==='pending') 
                        self.abort(RangeError("exceeded timeout")); 
                }
            }    
            this.timer = setTimeout(f,t);
        }       

        return this;
    };

    /**
     * Attaches a `handle`. In an Ajax scenario this could be the xhr object
     *
     * @param {Object} handle
     * @returns {Object} promise
     * @api public
     */
    Promise.prototype.attach = function(handle){
         
        Object.defineProperty(this,'attached',{
            enumerable:false,
            value: handle
        });

        return this;
    };

    /**
     * Aborts pending request by attemtping to call `attached.abort()` and then rejecting promise. 
     *
     * @param {Object} message
     * @returns {Object} promise
     * @api public
     */
    Promise.prototype.abort = function(message){
        if(this.attached && typeof this.attached.abort === 'function')
            this.attached.abort(message);

        this.reject(message);

        return this;
    };


    module.exports = Promise;   
})();