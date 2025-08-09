


const ContentScript = new function() {

    "use strict";

    const start = Date.now();
    const any = (window.wrappedJSObject ? "-moz" : "-webkit") + "-any";
    const frameSelector = `iframe:${any}(:not([src]), [src^='javascript:' i], [src^='about:blank' i]):not([flashstopped])`;
    
    var data = {debug: false};
    const _trace = function TRACE(format, ...etc) {
        if (!data.debug) return TRACE._noop || (TRACE._noop = function(){});    
        return console.log.bind(console, "### " + format + " ###", ...etc);
    };
    
    var selector = null;
    var handler = null; //loadURL(chrome.extension.getURL("script/handler.js"));
    var href = frameElement !== null ? frameElement.src || "about:blank" : location.href;
    var ret = 0;

    _trace("ready(%s) content.js - iframe: %s href: %s loc: %s fs: %s")(start - Date.now(), 
        !!frameElement && frameElement.id, href == location.href || href, location.href, window.flashstopped);

    if (window.flashstopped) return;
    window.flashstopped = true;

    chrome.runtime.sendMessage("permission", handlePermission);
    function handlePermission(response) { 
        if (chrome.runtime.lastError && ret <= 3) {
            console.error(`handlePermission - error ret: ${ret} msg: ${chrome.runtime.lastError.message}`);
            window.setTimeout(function() { chrome.runtime.sendMessage("permission", handlePermission)}, ret++ * 250);
        };
        if (!response) return; 
        data = response.data;
        selector = response.selector;
        handler = `${response.uhandler}\n\n${response.handler}`;
        if (!response.allow) load(window); 
        addEventListener("message", function(e) {
            if (e.data && e.data.id == "userinput") e.stopImmediatePropagation();
        }, true);          
    };

    if (parent && parent != window)
        parent.postMessage({id: "userinput"}, "*");

    function load({window, frameElement, location}) 
    {    
        var href = frameElement !== null ? frameElement.src || "about:blank" : location.href;
        _trace("loading(%s) content.js - iframe: %s href: %s loc: %s")(start - Date.now(),
             !!frameElement && frameElement.id, href == location.href || href, location.href);
        
        var match = 0, query = 0;
        var injected = false;
        var body = window.document.body;
        var userInput = null;
       
        var n = handleDocument();
        _trace("body: %s n: %s")(!!body, n);
        
        var docObserver = new MutationObserver(function(mutations) {        
        
            _trace("!!! docObserver - body: %s neb: %s !!!")(!!body, body != window.document.body);
            if (window.document.body && body != window.document.body) {
                if (body) observer.observe(window.document.body, { subtree: true, childList: true});
                body = window.document.body;
                requestAnimationFrame(function() {
                    var n = handleDocument();
                    _trace(">>>>>>> requestAnimationFrame n: %s <<<<<<<")(n);
                });              
                window.setTimeout(function() {
                    var n = handleDocument();
                    _trace(">>>>>>> setting body observer - n: %s <<<<<<<<")(n);
                }, 500);
                var n = handleDocument();
                _trace("!!! docObserver - out n: %s !!!")(n);
            }
        });        

        var observer = new MutationObserver(function(mutations) {
            
            for (var i = 0; i < mutations.length; i++)
                for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                    var addedNode = mutations[i].addedNodes[j];
                    if (addedNode.nodeType === 1){
                        match++;
                        if (addedNode.children.length) query++;
                        if (handleNodesDeep(addedNode, true)) {
                            _trace(">>>>>>> MutationObserver: tag: %s id: %s <<<<<<<")(addedNode.localName, addedNode.id);
                        }  
                        var frames = addedNode.matches(frameSelector) ? [addedNode] : [];
                        if (frames.push(...addedNode.querySelectorAll(frameSelector)))
                            handleFrames(frames);
                    }
                }
        });
        
        if (window.document.body) 
            observer.observe((href.search("^https?:") == -1) ? window.document : window.document.body
                , { subtree: true, childList: true});
        
        docObserver.observe(window.document.documentElement, { childList: true});
        
                            // workaround for chrome no events on blank iframe ...
        setTimeout(function setup() { 
            ["mousedown","mouseup", "keydown"].forEach((a) => window.addEventListener(a, function(e) { 
                if (e.isTrusted && (e.button % 2 == 0 || ["Enter", "Space"].includes(e.code))) {
                    if (e instanceof e.view.KeyboardEvent) {
                        var rect = e.target.getBoundingClientRect();
                        var clientX = rect.left + rect.width / 2, clientY = rect.top + rect.height / 2;
                        var pageX = clientX + e.view.scrollX, pageY = clientY + e.view.scrollY;
                        Object.assign(e, {clientX, clientY, pageX, pageY});
                    }
                    userInput = {e: e, time: Date.now()};
                    if (injected) dispatchUserInput(userInput);
                }
            }, true));
            window.addEventListener("mousedown", onContextMenu, true);
            if (data.debug) chrome.storage.local.get(["selector-css"], function(data) {
                window.document.head.appendChild(document.createElement("style"))
                    .textContent = data["selector-css"];
            });
            if (frameElement && window.document.readyState == "complete")
                frameElement.addEventListener("load", setup);
        }, 1000);

        window.addEventListener("DOMContentLoaded", function() {
            observer.observe(window.document.body, { subtree: true, childList: true});
            var n = handleDocument();       
            _trace(">>>>>>> DOMContentLoaded  n: %s match: %s query: %s iframe: %s loc: %s <<<<<<<")
                (n , match, query, !!frameElement && frameElement.id, location.href);
        }, true);
        
        window.addEventListener("message", function(e) {
            if (!e.data || e.data.id != "userinput") return;
            if (e.source == window.parent) {
                _trace("@@@ handleMessage(userinput) @@@@")();
                var si = new MouseEvent("siminput", Object.assign({view: window}, e.data));
                userInput = {e: Object.defineProperty(si, "target", {value: window}), time: e.data.time};
                if (injected) dispatchUserInput(userInput);
            }
            if (e.source && e.source.parent == window && userInput) {
                var iframe, iframes = [...window.document.querySelectorAll("iframe")];
                if (userInput.e.target.shadowRoot) iframes.push(...userInput.e.target.shadowRoot.querySelectorAll("iframe"));
                if (iframe = iframes.find((a) => a.contentWindow == e.source)) { 
                    var ue = userInput.e, time = userInput.time, r = iframe.getBoundingClientRect();
                    var data = {id: "userinput", clientX: ue.pageX - r.left - scrollX, clientY: ue.pageY - r.top - scrollY, time};
                    e.source.postMessage(data, "*");
                    _trace("@@@ iframe.postMessage(userinput) @@@")();
                }
            }
        }, true);
        
        window.addEventListener("flashstop:shadow", function(e) {
            var el = e.target, path = e.composedPath();
            if (path && path[0] != el) el = path[0];
            if (handleNodesDeep(el, true))
                _trace(">>>>>>> flashstop:shadow tag: %s <<<<<<<")(el.localName);
        }, true);

        function handleDocument()
        {
            var nodes = handleNodesDeep(window.document.body || window.document.documentElement);
            var frames = (window.document.body || window.document.documentElement).querySelectorAll(frameSelector);
            if (frames.length) handleFrames(frames);
            return nodes;
        };

        function handleNodes(nodes, delayed)
        {
            if (!injected) {
                if (href.search("^https?:") == -1 && !delayed) 
                    return window.setTimeout(function(){ handleNodes(nodes, true)});
                injected = loadScript();
                if (userInput) dispatchUserInput(userInput);
            }
            nodes.forEach(function(node) { 
                node.setAttribute("flashstopped", true);
                try { node.parentNode.setAttribute("flashstopped_p", true)} catch(e){};
                if (!node.flashstopped) {
                    node.dispatchEvent(new Event("flashstop:bind", {bubbles: true, composed: true}));
                    chrome.runtime.sendMessage("count");
                    _trace("match: %s query: %s")(match, query);
                }
                node.flashstopped = true;
            });
        };
        
        function handleFrames(frames)
        {
            if (!window.wrappedJSObject) frames.forEach(function(frame) {
                if (!frame.contentWindow) return;
                try {
                    _trace("!!! iframe - id: %s src: %s fs: %s !!!")(frame.id, frame.src, frame.contentWindow.flashstopped);
                    if (!frame.contentWindow.flashstopped) {
                        frame.setAttribute("flashstopped", true);
                        frame.contentWindow.flashstopped = true;
                        frame.contentWindow.Function('parent.postMessage({id: "userinput"}, "*")')();
                        window.setTimeout(function(){ load(frame.contentWindow)});
                    };
                } catch(e){};
            });
        };
        
        function handleNodesDeep(node, match)
        {
            if (node.shadowRoot) node.setAttribute("flashstop-shadow", true);
            var nodes = match && node.matches(selector) ? [node] : [];
            var count = nodes.push(...node.querySelectorAll(selector));
            for (var el of nodes.filter((a) => a.shadowRoot)) {
                nodes.splice(nodes.indexOf(el), 1)[0].setAttribute("flashstopped", true);
                count += handleNodesDeep(el.shadowRoot) - 1;
                observer && observer.observe(el.shadowRoot, { subtree: true, childList: true}); // fgc
            }
            if (nodes.length) handleNodes(nodes);
            return count;
        };
        
        function loadScript()
        {
            var code = `(function(data){ ${_trace} ${Handlers} ${handler} (${init})()})(${JSON.stringify(data)})`;
            var script = window.document.createElement("script");
            script.textContent = code;
            if (window.wrappedJSObject)
                script.textContent += "\ndocument.currentScript.dispatchEvent(new Event('load'));";
            script.onload = function() { this.executed = true};
            (window.document.head || window.document.documentElement).appendChild(script);
            script.remove();
            
            if (window.wrappedJSObject && !script.executed)   // fff
                try { window.eval(code); } catch(e) {};

            return true;
        };
                            // initilaizer & adapter for the injection code...
        function init()
        {
            var handlingUserInput = false
            var lastUserInput = null;
            var handlers = new Handlers(TRACE);
            function isHandlingUserInput() { return handlingUserInput = handlingUserInput && Date.now() - lastUserInput.time < 100 };
            
            registerUserHandlers(handlers, TRACE, isHandlingUserInput, () => TRACE("setHandlingUserInput")(), () => lastUserInput, data);
            registerHandlers(handlers, TRACE, isHandlingUserInput, () => TRACE("setHandlingUserInput")(), () => lastUserInput, data);
            
            window.addEventListener("userinput", function(e) { 
                handlingUserInput = true;
                setTimeout(function() { handlingUserInput = false;});
                lastUserInput = {e: Object.assign({target: e.target}, e.detail.e), time: e.detail.time};
            }, true);
            window.addEventListener("flashstop:bind", function onbind(e){
                var aElement = e.target, path = e.composedPath();
                if (path && path[0] != aElement) aElement = path[0];
                TRACE("onElementBinding - tag: %s id: %s loc: %s")(aElement.localName, aElement.id, window.location.href);
                window.wrappedJSObject = window;
                try { 
                    handlers.apply(wrapper(aElement));
                } catch(e) {
                    aElement.addEventListener("playing", () => {
                        if (!lastUserInput || Date.now() - lastUserInput.time > 1500) aElement.pause();
                })};
                delete window.wrappedJSObject;
            }, true);
                                    
            function wrapper(node)
            {
                var proxy = new Proxy(node, { get: function(target, prop, receiver) {
                        var proto = Object.getPrototypeOf(node);
                        var res = Reflect.get(proto, prop, node);
                        return typeof res == "function" && res.bind ? res.bind(node) : res;
                    }, set: function(target, prop, value, receiver) { 
                        var proto = Object.getPrototypeOf(node);
                        return Reflect.set(proto, prop, value, Reflect.has(proto, prop) ? node : receiver);
                    }});
                return Object.create(proxy, {wrappedJSObject: { value: node}});
            };

            TRACE("addEventListener - flashstop:bind")();
        };           
        
        function inRect(x, y, el){ var b = el.getBoundingClientRect(); return (x > b.left && x < b.right && y > b.top && y < b.bottom) ? el : null};
        function shadowRoot(el) { 
            return el.shadowRoot || (chrome.dom && chrome.dom.openOrClosedShadowRoot(el)) || el.openOrClosedShadowRoot;
        };
        function matchDeep(el, x, y, res) { 
            if (!shadowRoot(el)) return el.matches("video, audio") ? el : null;
            for (var n of [...shadowRoot(el).elementsFromPoint(x, y)].filter((a) => a.getRootNode().host == el))
                 if (res = matchDeep(n, x, y)) return res;
            return [...shadowRoot(el).querySelectorAll("video")].find((node) => inRect(x, y, node));
        };
        function getMediaElement(aWin, aPrev, x, y)
        {
            try {aWin.document} catch(e) { _trace("getMediaElement - %s")(e); return };
            var res, sx = x + aWin.mozInnerScreenX, sy = y + aWin.mozInnerScreenY, round = Math.round;
            _trace("sc(%s,%s) win(%s,%s) win: %s prev: %s")(round(sx), round(sy), round(x), round(y), aWin.location.host, aPrev && aPrev.location.host);
            for (var node of aWin.document.elementsFromPoint(x, y))
                if (res = (node.localName != "iframe" || node.contentWindow == aPrev) ? matchDeep(node, x, y) :
                    getMediaElement(node.contentWindow, null, x - node.getBoundingClientRect().left, y - node.getBoundingClientRect().top))
                        return (res.localName != "iframe" && _trace("getMediaElement - success id: %s")(res.id), res);
            if (res = [...aWin.document.querySelectorAll("video:not([src^='data:'])")].find((node) => inRect(x, y, node)))
                return (_trace("getMediaElement - success id: %s")(res.id), res);
            return (aPrev && aWin != aWin.parent && aWin.frameElement) && getMediaElement(aWin.parent, aWin, x + 
                aWin.frameElement.getBoundingClientRect().left, y + aWin.frameElement.getBoundingClientRect().top);
        };                         

        function onContextMenu(e)
        {                               // before 
            if (e.isTrusted && e.button == 2){
                var media = e.target instanceof HTMLMediaElement ? e.target : getMediaElement(e.view, e.view, e.clientX, e.clientY);
                var paused = media && media.paused;
                if (media) {
                    chrome.runtime.sendMessage({ msg: "contextmenu", media: true, paused }, 
                        function(){ if (!chrome.runtime.lastError) paused ? media.play() : media.pause(); });
                    if (e.ctrlKey)
                        window.addEventListener("contextmenu", (e) => e.stopImmediatePropagation(), {capture: true, once: true});
                } 
                else  
                    chrome.runtime.sendMessage({ msg: "contextmenu", media: false});
            }
        };          
    };
};

function dispatchUserInput({e, time, e: {view: window}})
{                                       // fff!
    with(e) var Obj = window.Object, data = Object.assign(new Obj, {clientX, clientY, pageX, pageY});
    var target = e.target != window && window.document.contains(e.target) ? e.target : window;
    target.dispatchEvent(new CustomEvent("userinput", {detail: Object.assign(new Obj,{e: data, time})}));
};

// </>