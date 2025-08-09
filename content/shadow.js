

"use strict";

(function() {
    var script = document.createElement("script");
    script.textContent = `(${handleShadow})()`;
    (document.head || document.documentElement || document).appendChild(script);
    script.remove();
      
    function handleShadow(){
        Element.prototype.attachShadow = new Proxy(Element.prototype.attachShadow, { 
            apply: function(target, thisArg, [options]) {
                if (options && options.mode) options.mode = "open";
                var shadowRoot = Reflect.apply(target, thisArg, [options]);
                setTimeout(function() {
                    thisArg.setAttribute("flashstop-shadow", true);
                    if (document.readyState != "loading")
                        thisArg.dispatchEvent(new Event("flashstop:shadow", {bubbles: true, composed: true}));
                });
	            return shadowRoot;
        }});
    };
})();

// </>

