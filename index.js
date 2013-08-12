
var uP = require('uP');

(function(){
    function Promise(o){

        var timer;

        var Methods = {

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
            async: function(){
                var self = this,
                    args = Array.prototype.slice.call(arguments),
                    proc = args.shift(),
                    ret;

                task(function(){
                    try {
                        ret = proc.apply(null,args);
                        if(isPromise(ret)) ret.then(self.fulfill,self.reject);
                        else if(ret !== undefined) self.fulfill(ret);
                    } catch (e) {
                        self.reject(e);
                    }
                });

                return this;
            },
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
            async2: function(){
                var self = this,
                    args = Array.prototype.slice.call(arguments);

                function callback(err,ret){ if(!e) self.fulfill(ret); else self.reject(ret); }

                args[args.length] = callback;

                return this.async.apply(this,args);
            },

            /**
             * Joins promises and assembles return values into an array.
             * If any of the promises rejects the rejection handler is called with the error.  
             * 
             * Example: join two promises
             *      p = uP();
             *      a = uP();
             *      b = uP();
             *      p.join([a,b]).spread(function(x,y){
             *          console.log('a=%s, b=%s',x,y);
             *      },function(err){
             *          console.log('error=',e);
             *      });
             *      b.fulfill('hello');
             *      a.fulfill('world'); // => 'a=hello, b=world' 
             *      p.resolved(); // => ['hello','world']
             *
             * @param {Array} promises
             * @return {Object} promise
             * @api public
             */
            join: function(promises){
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
            },


            wrap: function(proto){
                var self = this;

                return function(){
                    var args = Array.prototype.slice.call(arguments), ret;

                    if(isPromise(proto)){
                        proto.fulfill(args).then(self.fulfill,self.reject);
                    } else if(typeof proto === 'function'){
                        try{
                            ret = proto(args);
                            self.fulfill(ret);
                        } catch(err) {
                            self.reject(err);
                        }
                    }
                        
                    return self;
                }              
            },


            /**
             * Spread has the same semantic as then() but splits multiple fulfillment values & rejection reasons into separate arguments  
             * 
             * Example: Fulfillment array elements as arguments
             *      var p = uP();
             *      p.fulfill([1,2,3]).spread(function(a,b,c){
             *          console.log(a,b,c); // => 123
             *      });     
             *      
             * @param {Function} onFulfill callback with multiple arguments
             * @param {Function} onReject errback with multiple arguments  
             * @return {Object} promise for chaining
             * @api public
             */
            spread: function(f,r){    
                function s(h){
                    return function(v){
                        if(!Array.isArray(v)) v = [v];
                        return h.apply(null,v); 
                    }
                }

                return this.then(s(f),s(r));
            },

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
            timeout: function(t,f){
                var self = this;

                if(t === null || state) {
                    clearTimeout(timer);
                    timer = null;
                } else if(!timer){
                    f = f ? f : function(){ self.reject(RangeError("exceeded timeout")) }
                    timer = G.setTimeout(f,t);
                }       

                return this;
            }
        };

        return uP(Methods);
    }
    module.exports = Promise;   
})();