/** simple js performance test framework
 *  author: Paul "kulpae" Koch <my.shando@gmail.com>
 */

(function(){

var module_counter = 0;
var test_counter = 0;

function Module(name, callbacks){
  if(!name) name = "module #"+(++module_counter);
  this.name = name;
  this.callbacks = callbacks;
  this.tests = [];
}

Module.prototype.addTest = function addTest(test){
  this.tests.push(test);
};

Module.prototype.run = function run(queue, options){
  var cbs = this.callbacks;
  var repeat_test = Math.max(1, options && options.repeat_test || 1);
  if(cbs && cbs["pre_module"]) queue.push(null, cbs["pre_module"]);
  this.tests.forEach(function(test){
    for(var i=0; i < repeat_test; i++){
      if(cbs && cbs["pre_test"]) queue.push(null, cbs["pre_test"]);
      queue.push(test, test.run, test.runEnd);
      if(cbs && cbs["post_test"]) queue.push(null, cbs["post_test"]);
    }
  });
  if(cbs && cbs["post_module"]) queue.push(null, cbs["post_module"]);
}

function ResultData(){
  this.values = [];
  this.domElement = null;
  this._state = 'init';
}

ResultData.prototype.bind = function bind(domElement){
  this.domElement = domElement;
  this.text('waiting');
};

ResultData.prototype.run = function run(){
  if(this.values.length === 0){
    this.text('running...');
  }
  this.state('run');
};

ResultData.prototype.add = function add(value){
  this.values.push(value);
  this.update();
};

ResultData.prototype.text = function text(value){
  this.domElement.html(value);
};

ResultData.prototype.state = function state(value){
  if(this._state !== "fail"){
    this._state = value;
    if(value === "run"){
      this.domElement.css('background-color', '#ffa');
    } else if(value === "fail"){
      this.domElement.css('background-color', '#fbb');
    } else {
      this.domElement.css('background-color', '#afa');
    }

  }
};

ResultData.prototype.fail = function fail(){
  this.text("failed");
  this.state('fail');
};

ResultData.prototype.update = function update(){
  var mean = this.mean();
  var plusMinus = this.stddev(mean)/2.0;
  this.text(""+mean.toFixed(2) + "ms  +/- "+plusMinus.toFixed(2)+"ms");
  this.state('done');
};

ResultData.prototype.mean = function mean(){
  return this.values.reduce(function(prev, cur){
    return prev + cur;
  }, 0) / this.values.length;
};

ResultData.prototype.stddev = function stddev(mean){
  var mean = mean || this.mean();
  var sq_deviation = this.values.reduce(function(prev, cur){
    return prev + (cur - mean) * (cur - mean);
  }, 0) / this.values.length;
  return Math.sqrt(sq_deviation);
};

function Test(name, func){
  if(!name) name = "test #"+(++test_counter);
  this.name = name;
  this.fn = func;
  this.result = new ResultData();
}

Test.prototype.run = function run(queue){
  this.result.run();
  try {
    this.time = +(new Date());
    this.fn.call(queue, queue);
  } catch(e) {
    queue.error(e);
  }
};

Test.prototype.runEnd = function runEnd(queue){
  //100 is the delay before a test
  //as the runEnd part is scheduled like a test, it's part of the delay
  var time = +(new Date()) - this.time - 100;
  if(queue.hasErrors()){
    this.result.fail();
  } else {
    this.result.add(time);
  }
};

function Queue(){
  this.queue = [];
  this.errorOccured = [];
  this.stopCounter = 0;
  this.taskWaiting = false;
  this.ctx = {
    error: this.error.bind(this),
    stop: this.stop.bind(this),
    start: this.start.bind(this),
    hasErrors: this.hasErrors.bind(this)
  };
}

Queue.prototype.push = function push(obj, func1, func2){
  var obj = arguments[0];
  for(var i = 1; i < arguments.length; i++){
    this.queue.push([obj, arguments[i]]);
  }
};

Queue.prototype.renderErrors = function renderErrors(){
  this.errorRenderFn(this.errorOccured);
};

Queue.prototype.error = function error(errObj){
  this.errorOccured.push(errObj);
};

Queue.prototype.stop = function stop(n){
  this.stopCounter += n || 1;
};

Queue.prototype.start = function start(n){
  this.stopCounter -= n || 1;
  if(this.stopCounter <= 0 && this.taskWaiting){
    this.next();
  }
};

Queue.prototype.hasErrors = function hasErrors(){
  return this.errorOccured.length > 0;
};

Queue.prototype.next = function next(){
  var nextItem = this.queue.shift();
  var queue = this;
  if(queue.hasErrors()){
    queue.renderErrors();
    this.errorOccured.clear();
  }
  this.stopCounter = 0;
  this.taskWaiting = false;
  if(nextItem){
    window.setTimeout(function(){
      nextItem[1].call(nextItem[0] || queue.ctx, queue.ctx);
      if(queue.hasErrors()){
        queue.renderErrors();
        queue.errorOccured.clear();
      }
      if(queue.stopCounter <=0){
        queue.next();
      } else {
        queue.taskWaiting = true;
      }
    }, 100);
  }
};

function Perftest(options){
  this.modules = [];
  this.queue = new Queue();
  this.options = options;
}

Perftest.prototype.module = function module(name, callbacks){
  var module = new Module(name, callbacks);
  this.modules.push(module);
  this.currentModule = module;
};

Perftest.prototype.test = function test(name, func){
  if(!this.currentModule) this.module();
  var test = new Test(name, func);
  this.currentModule.addTest(test);
};

Perftest.prototype.init = function init(){
  var perf = this;
  jQuery(function(){
    var containers = jQuery('#perftest');
    if(containers.length > 0){
      perf.render(containers.get(0));
      perf.run();
    }
  });
};

function placeholder(module, test){
  return $('<td/>', {text: "waiting..."});
}

Perftest.prototype.render = function render(container){
  var container = $(container);
  var table = $('<table/>', {class: 'perftable'});
  var header = $('<tr/>');
  var td,
      th = $('<th/>');
  header.append(th);

  table.append(header);
  container.append(table);

  var errorContainer = $('<div />', {class: 'errors'});
  errorContainer.hide();
  errorContainer.append("<h3>Errors:</h3>");
  container.append(errorContainer);

  this.queue.errorRenderFn = function errorRenderFn(errors){
    errors.forEach(function(err){
      var errorElem = $('<div />', {
        class: 'error', 
        text: err+''
      });
      errorContainer.append(errorElem);
    });
    errorContainer.show();
  };

  var modulesN = this.modules.length;
  this.modules.forEach(function(module, module_idx){
    th = $('<th/>', {text: module.name});
    header.append(th);

    module.tests.forEach(function(test){
      var name = test.name;
      var path = name.replace(/[\W]/g, '-');
      var row = $('.row_'+path, table);
      if(row.length === 0){
        row = $('<tr/>', {class: 'row_'+path});
        table.append(row);
        td = $('<td/>', {text: name});
        row.append(td);
        for(var i=0; i<modulesN; i++){
          td = $('<td/>', {class: "module_"+i});
          row.append(td);
        }
      }
      td = placeholder(module, test);
      test.result.bind(td);
      $('.module_'+module_idx, row).replaceWith(td);
    });
  });
};

Perftest.prototype.run = function start(){
  var queue = this.queue;
  var perf = this;
  this.modules.forEach(function(module){
    module.run(queue, perf.options);
  });
  queue.next();
};

Perftest.prototype.toString = function toString(){
  var modulesN = this.modules.length;
  var testsN = this.modules.reduce(function(prev, module){
    return prev + module.tests.length;
  }, 0);
  return "Perftest, #modules: "+modulesN+", #tests: "+testsN;
};


window.Perftest = Perftest;
})();
