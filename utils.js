

"use strict";

const i18n = new function(){

    return {
        process: function (doc) {
            var elements = doc.querySelectorAll("[i18n-content]");
            for (var i = 0; i < elements.length; ++i) {
                var element = elements[i];
                var message = chrome.i18n.getMessage(element.getAttribute("i18n-content"));
                if (message) element.textContent = message;
                else
                    console.warn("i18n: no message for " + element.getAttribute("i18n-content"));
            }
        }
    };
};

const Storage = function Storage(keys, areaname){

    var listeners = [];
    var data = {};
    var ready = new Promise(function (resolve, reject) { 
        chrome.storage[areaname].get(keys, function(items){
            Object.assign(data, items);
            if (!chrome.runtime.lastError) resolve();
        })
    });
    
    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area == areaname) {
            var updated = [];
            for (var key of Object.keys(changes)) 
                if (keys.indexOf(key) != -1) { data[key] = changes[key].newValue; updated.push(key); };
            fireChanged(updated);
        }
    });
        
    return {
        get ready() { return ready; },
        get data() { return data; },
        addChangeListener: function(listener) { listeners.push(listener); return listener; },
        removeChangeListener: function(listener) { var idx = listeners.indexOf(listener); if (idx != -1) listeners.splice(idx); },        
        commit: function commit(keys, callback) {
            var items = {};
            for (var key of keys) items[key] = data[key];
            chrome.storage[areaname].set(items, function(){
                if (callback) callback(chrome.runtime.lastError);
            });
        }
    };
    
    function fireChanged(updated) { for (var listener of listeners) listener(updated); };    
}; 

const Permission = {
    UNKNOWN_ACTION: 0,
    ALLOW_ACTION:	1, 	
    DENY_ACTION: 	2, 	
    PROMPT_ACTION:  3,
    DENY_ACTION_EX: 4,
    ACCESS_SESSION: 8
};   

const Permissions = class Permissions {
  
   constructor(data) {
     
      function getData(type){ return data[Permissions.key(type)] || (data[Permissions.key(type)] = {}); };
      function getDefault(type){ return data[Permissions.defaultKey(type)]; };     
     
      Object.assign(this, {
          testPermission: function testPermission(type, uri, parent) {
              var origin, url = new window.URL(uri);
              var hostTokens = url.host.split(".").slice(parent);
              do {
                  var permission = getData(type)[origin = url.protocol + "//" + hostTokens.join(".")];
                  if (permission != undefined && permission != Permission.UNKNOWN_ACTION)
                      return Object.assign(Number(permission), {origin});
              } while (hostTokens.shift());
              return getDefault(type);
          },
          clear: function clear(type) { data[Permissions.key(type)] = {}; },
          set: function set(type, url, perm) { getData(type)[new window.URL(url).origin] = perm; },
          remove: function remove(type, url) { delete getData(type)[new window.URL(url).origin]; },
          get: function get(type, url) { return getData(type)[new window.URL(url).origin]; },
          setDefault: function setDefault(type, perm) { data[Permissions.defaultKey(type)] = perm; },
          default: function _default(type) { return getDefault(type); },
          entries: function entries(type) { return Object.entries(getData(type)); },
      });     
   };
  
   key(type) { return Permissions.key(type); };
   defaultKey(type) { return Permissions.defaultKey(type); };
  
   static key(type) { return `perms:${type}`; };
   static defaultKey(type) { return `perms:${type}Default`; };  
};

Object.assign(Permissions.prototype, Permission);

//</>