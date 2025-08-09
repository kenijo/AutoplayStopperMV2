

"use strict";

var Background = new function() {

    console.log("loading background.js ...");

    const {js, css} = chrome.runtime.getManifest().content_scripts[0];
    const badgeColor = "#646464";
    const playMsg = chrome.i18n.getMessage("play");
    const pauseMsg = chrome.i18n.getMessage("pause");
    const sArea = "local";
    const permsAutoplayKey = Permissions.key("autoplay");
    const permsAutoplayDefaultKey = Permissions.defaultKey("autoplay");
    const permsFlashKey = Permissions.key("flash");
    const permsFlashDefaultKey = Permissions.defaultKey("flash");
    const sKeys = ["disabled", "debug", permsFlashKey, permsFlashDefaultKey, permsAutoplayKey,
                    permsAutoplayDefaultKey, "selector-css", "uhandler", "handler", "disableOverwrite", "devtools"];
                    
    var selector = null;
    var permissions = null;
    var permsAutoplayCache = {};
    var permsFlashCache = {};
    var tabs = { get(id) { return this[id] || (this[id] = {id, count: 0})}};
    var menuitem = null;

    var storage = new Storage(sKeys, sArea);
    storage.addChangeListener(function(changes){
        if (changes.indexOf("selector-css") != -1) selector = storage.data["selector-css"].split("{")[0];
        if (changes.indexOf(permsAutoplayKey) != -1 || changes.indexOf(permsAutoplayDefaultKey) != -1) permsAutoplayCache = {};
        if (changes.indexOf(permsFlashKey) != -1 || changes.indexOf(permsFlashDefaultKey) != -1) permsFlashCache = {};
        if (changes.indexOf("disabled") != -1) updateIcon();
    });
    
    storage.ready.then(function() { 
        console.log("storage.ready");
        updateIcon();        
        permissions = new Permissions(storage.data);
        if (permissions.default("autoplay") === undefined) permissions.setDefault("autoplay", Permission.DENY_ACTION);
        if (permissions.default("flash") === undefined) permissions.setDefault("flash", Permission.ALLOW_ACTION);
        chrome.webNavigation.onCommitted.addListener(onCommitted, {url: [{schemes: ["http", "https", "about"]}]});
        if (!storage.data.uhandler)
            loadScript("uhandler", chrome.extension.getURL("script/userhandler.js"));
        if (!storage.data.handler)
            loadScript("handler", chrome.extension.getURL("script/handler.js"));
        if (!storage.data["selector-css"])
            loadScript("selector-css", chrome.extension.getURL("script/selector.css"));
        selector = storage.data["selector-css"].split("{")[0];
        js.forEach(function(a) { execScript(a, null, 0)});
    });
    
    chrome.browserAction.setBadgeBackgroundColor({color: badgeColor});
    chrome.tabs.onRemoved.addListener(function(tabid){ delete tabs[tabid]; });
    chrome.tabs.onActivated.addListener(resetMenuitem);
    chrome.runtime.onMessage.addListener(handleMessage);
    chrome.runtime.onInstalled.addListener(function(details) {
        if (details.reason == "update" && !storage.data.disableOverwrite) {
            loadScript("handler", chrome.extension.getURL("script/handler.js"));
            loadScript("selector-css", chrome.extension.getURL("script/selector.css"));
            selector = storage.data["selector-css"].split("{")[0];
        }
    });
 
    return {
        get i18n() { return i18n; },
        get storage() { return storage; },
        get permissions() { return permissions; },
        openOptionsPage: function openOptionsPage(hash) {
            chrome.runtime.openOptionsPage();
            if (hash) addEventListener("message", function(e) { 
                    if (location.origin == e.origin && e.data == "optionsPageActive") 
                        e.source.location.hash = hash; 
                }, { once: true}); 
        }
    };

    function resetMenuitem(){ if (menuitem) menuitem = chrome.contextMenus.remove("play-menuitem"); }    

    function updateIcon() { chrome.browserAction.setIcon({ path: "/icons/" + (storage.data.disabled ? "icon32d.png" : "icon32.png")})};

    function handleMessage(request, sender, sendResponse) 
    {
        if (!storage.data.handler) {
            console.log("handleMessage delayed -", request, sender);
            storage.ready.then(function() { handleMessage(request, sender, sendResponse)});
            return true;
        }        
        if (request == "permission") {    
            var data = {debug: !!storage.data.debug};
            var allow = true, host = sender.tab && new URL(sender.tab.url).origin;
            if (host && !storage.data.disabled) {        
                var permission = permsAutoplayCache[host] || 
                    (permsAutoplayCache[host] = permissions.testPermission("autoplay", sender.tab.url));
                allow = permission == Permission.ALLOW_ACTION ||
                    (permission == Permission.ACCESS_SESSION && tabs.get(sender.tab.id).last == host);
                data.strict = permission == Permission.PROMPT_ACTION;
            }            
            var msg = {msg: "permission", data, allow, selector, handler: storage.data.handler, uhandler: storage.data.uhandler};
    //        console.log("background send:", msg, sender.url, sender.tab.url);
            sendResponse(msg);
        }
        if (request == "count") 
            chrome.browserAction.setBadgeText({text: String(++tabs.get(sender.tab.id).count), tabId: sender.tab.id});
        if (request.msg == "contextmenu") {
            resetMenuitem();
            if (request.media)
                menuitem = chrome.contextMenus.create({ id: "play-menuitem", title: request.paused ? playMsg : pauseMsg, 
                    contexts: ["all"], onclick: function onClick(info, tab) { if (info.menuItemId == "play-menuitem") sendResponse();}
                })
            return !!request.media;
        }
        if (request.msg == "select") {
            fetch(request.url, {cache: "no-store"}).then(function(res) {
                res.blob().then(function(file){ sendResponse({url: URL.createObjectURL(file), name: file.name}); });
            });
            return true;      
        }        
        if (request.msg == "load") {
            var res = loadScript(request.script, request.file); 
            sendResponse(res);
        }
    };
    
    function onCommitted(details)
    {
        var allow = true, url = new URL(details.url);
        if (url.protocol.search("^chrome") != -1) return;
        
        var tab = tabs.get(details.tabId);
        if (details.frameId == 0) {
            tab.last = tab.host;
            tab.host = url.origin;
            tab.url = details.url;
            tab.count = 0;
            chrome.browserAction.setBadgeText({text:'', tabId: tab.id});
            chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].id == tab.id) resetMenuitem();
            });
        }
        if (!storage.data.disabled && tab.url) {        
            var permission = permsFlashCache[tab.host] || 
                (permsFlashCache[tab.host] = permissions.testPermission("flash", tab.url));
            if (permission == Permission.DENY_ACTION)
                execScript("content/navigator.js", details.tabId, details.frameId);
            permission = permsAutoplayCache[tab.host] || 
                (permsAutoplayCache[tab.host] = permissions.testPermission("autoplay", tab.url));
            if (permission == Permission.DENY_ACTION_EX)
                execScript("content/shadow.js", details.tabId, details.frameId);
        }              
    };

    function execScript(file, tabId, frameId) {
        chrome.tabs.executeScript(tabId, {file, frameId, matchAboutBlank: true, runAt: "document_start"}, function() {
            if (chrome.runtime.lastError && storage.data.debug)
                console.error("chrome.tabs.executeScript - error", chrome.runtime.lastError, {tabId, frameId, file});
        });
    };
    
    function insertCSS(file, tabId, frameId) {
        chrome.tabs.insertCSS(tabId, {file, frameId, matchAboutBlank: true, runAt: "document_start"}, function() {
            if (chrome.runtime.lastError && storage.data.debug)
                console.error("chrome.tabs.insertCSS - error", chrome.runtime.lastError, {tabId, frameId, file});
        });
    };

    function loadScript(script, url){
        try {
            var request = new XMLHttpRequest();
            request.overrideMimeType("text/plain");        
            request.open("GET", url, false);
            request.setRequestHeader("pragma", "no-cache");        
            request.send();
            if (request.statusText == "Not Found" || !request.responseURL)
                 throw new DOMException(`Failed to load '${url}'.`, "NetworkError");
                 
            storage.data[script] = request.responseText;
            storage.commit([script]);
        } catch (e) {
            chrome.extension.isAllowedFileSchemeAccess(function(allowed) {
                if(!allowed && url.search(/^blob:/) == -1) 
                    return alert(chrome.i18n.getMessage("allowFileUrls"));
                alert(`${chrome.i18n.getMessage("loadError")} ${e.name}\n  ${e.message}`);
            });        
            return e;
        }
    };   
};

//</>