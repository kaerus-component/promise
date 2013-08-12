
var G, uP = require('uP');

try { G = global } catch(e) { try { G = window } catch(e) { G = this } }

(function(){
    "use strict";

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
     * Example: 
     *      p = Promise();
     *      p.attach({x:2});
     *      p.fulfill(8).then(function(v){
     *          return v*this.attached.x;
     *      }).then(function(v){
     *          console.log("v=",v);    // => 'v=16'
     *      });
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
     * Aborts pending request by calling `attached.abort()` and then rejects promise. 
     *
     * Example: Ajax wrapper using attached(), abort() & timeout().
     *       function Ajax(options,data) {
     *           var res = Promise(),
     *               req = new XMLHttpRequest;
     *           options = options ? options : {};
     *           data = data ? data : null;
     *           if(typeof options !== 'object') options = {url:options};
     *           if(!options.method) options.method = "get";
     *           if(!options.headers) options.headers = {};
     *           if(!options.timeout) options.timeout = 5000;   // => set requst timeout
     *           if(!options.headers.accept) options.headers.accept = "application/json";
     *           res.attach(req);   // => attach request instance
     *           function handle(req,res){       
     *               var msg = req.responseText,
     *                   hdr = parseHeaders(req.getAllResponseHeaders());
     *               if(options.headers.accept.indexOf('json') >= 0) 
     *                   msg = JSON.parse(msg);
     *               if(req.status < 400) res.fulfill(msg,hdr);
     *               else res.reject(msg);  
     *           }
     *           function parseHeaders(h) {
     *               var ret = {}, key, val, i;
     *               h.split('\n').forEach(function(header) {
     *                   if((i=header.indexOf(':')) > 0) {
     *                       key = header.slice(0,i).replace(/^[\s]+|[\s]+$/g,'').toLowerCase();
     *                       val = header.slice(i+1,header.length).replace(/^[\s]+|[\s]+$/g,'');
     *                       if(key && key.length) ret[key] = val;
     *                   }   
     *               });
     *               return ret;
     *           }
     *           req.onreadystatechange = function() {
     *               if(req.readyState === 4 && req.status) {
     *                   // cancel response timer
     *                   res.timeout(null); 
     *                   handle(req,res);   
     *               }
     *           }
     *           // send an asynchronous XmlHttp request 
     *           req.open(options.method,options.url,true);
     *           // set request headers 
     *           Object.keys(options.headers).forEach(function(header) {
     *               req.setRequestHeader(header,options.headers[header]);
     *           });
     *           // send request 
     *           req.send(data);
     *           // set a timeout
     *           // note: on timeout the attached req.abort() will be called
     *           res.timeout(options.timeout);
     *           return res;
     *       }
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

    if(module && module.exports) module.exports = Promise;
    else if(typeof define ==='function' && define.amd) define(Promise); 
    else G.Promise = Promise; 
})();