

"use strict";

(function() {
    
    
//    setTimeout(function() {
        var script = document.createElement("script");
        script.textContent = `(${setNavigator})()`;
        (document.head || document.documentElement || document).appendChild(script);
        script.remove();
//    });
      
    function setNavigator(nav = { plugins: navigator.plugins, mimeTypes: navigator.mimeTypes}) {
        
        console.log("setNavigator - uri: " + location);

        var plugins = Object.assign(Object.create(PluginArray.prototype), [...nav.plugins]);
        Object.defineProperties(plugins, { item: {value: (a) => plugins[a]}, namedItem: {value: (a) => plugins[a]}, 
            refresh: {value: () => { nav.plugins.refresh(); setNavigator(nav)}}, 
            length: { writable: true, value: nav.plugins.length}});
        for (var a of plugins) { Object.defineProperty(plugins, a.name, {configurable: true, value: a}); };        
        [].splice.call(plugins, [].findIndex.call(plugins, (a) => a.name == "Shockwave Flash"), 1);
        delete plugins["Shockwave Flash"];
        Object.defineProperty(navigator, "plugins", {configurable: true, value: plugins});
                  
        var mimetypes = Object.assign(Object.create(MimeTypeArray.prototype), [...nav.mimeTypes]);
        Object.defineProperties(mimetypes, { item: {value: (a) => mimetypes[a]}, namedItem: {value: (a) => mimetypes[a]}, 
            refresh: {value: () => { plugins.refresh()}}, length: { writable: true, value: nav.mimeTypes.length}});            
        for (var a of mimetypes) { Object.defineProperty(mimetypes, a.type, {configurable: true, value: a}); };                    
        [].forEach.call(nav.plugins["Shockwave Flash"] || [], ({type}) => 
            delete mimetypes[[].splice.call(mimetypes, [].findIndex.call(mimetypes, (a) => a.type == type), 1)[0].type]);            
        Object.defineProperty(navigator, "mimeTypes", {configurable: true, value: mimetypes});
    };
})();

// </>

