
//      handler-utils.js See license.txt for terms of usage and credits

"use strict";
  
/**
*   Handlers - content handlers manager...
*   ----------------------------------------
*   @bYO!
*/

function Handlers(TRACE){

    var _handlers = [], _mapRemoved = new Map();           
    return {
        unload: function unload(){ 
             for (var win of _mapRemoved.keys()) { 
                win && win.removeEventListener("unload", onUnload, false); 
                TRACE("Handlers.unload - remove wnd loc: %s")(win && win.location);
            }; 
            _handlers = [];
            _mapRemoved = new Map();
        },
        add: function add(handler) { _handlers.push(handler); },
        remove: function remove(win, handler) { 
            if (!_mapRemoved.has(win)){
                win && win.addEventListener("unload", onUnload, false);
                _mapRemoved.set(win, []);
            }
            _mapRemoved.get(win).push(handler);
            TRACE("Handlers.remove - handler: %s")(handler.name || handler);
        },
        apply: function apply(element){
            var removed = _mapRemoved.get(element.ownerDocument.defaultView);
            removed = removed ? removed.concat(_mapRemoved.get(null) || []) : _mapRemoved.get(null);
            for (var handler of _handlers)
                if (!removed || !removed.find((a) => a == handler || a == handler.name))
                    try { 
                        if (handler(element)) break;
                    } catch (e) { TRACE("!!!!!!!!! handler: %s Exception: %s !!!!!!!!!")(handler.name, e); };
        },
        get length() { return _handlers.length; } 
    };      
    
    function onUnload(e){ 
        var win = e.target.defaultView;
        TRACE("Handlers.onUnload - remove wnd has: %s loc: %s")(_mapRemoved.has(win), win.location);
        _mapRemoved.delete(win);
    }        
};
