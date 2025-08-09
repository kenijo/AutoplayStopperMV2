

"use strict";

const Popup = new function(){

    const start = Date.now();
    const {i18n, storage, permissions: perms, openOptionsPage} = chrome.extension.getBackgroundPage().Background;

    while (Date.now() - start < 50);
    setTimeout(function() {
        while (Date.now() - start < 150);
        addEventListener("unload", function() { 
            if (!url && Date.now() - start < 250) {     // fvv
                storage.data.disabled = !storage.data.disabled;
                storage.commit(["disabled"]);
            }
        });
    });
    
    const permsAutoplayKey = perms.key("autoplay");
    const permsFlashKey = perms.key("flash");

    var url = null;
    var ready = new Promise( function(resolve) {
        chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
            url = new URL(tabs[0].url);
            resolve();
        })
    });
    
    addEventListener("load", function() { ready.then(init); });
    
    function init()
    {
        i18n.process(document);
        var permission = perms.testPermission("autoplay", url);
        var permissionFlash = perms.testPermission("flash", url);
        initItem( document.getElementById("allow_site"), !!permission.origin && permission != perms.ACCESS_SESSION && permission, [url.origin]);
        initItem( document.getElementById("allow_session"), !!permission.origin && permission == perms.ACCESS_SESSION, [url.origin]);
        initItem( document.getElementById("disable_site"), !!permissionFlash.origin && permissionFlash, [url.origin]);
        initItem( document.getElementById("allow_all"), storage.data.disabled);
        initItem( document.getElementById("settings"));
        document.getElementById("popupmenu")
            .classList.toggle("restricted", url.protocol.search("^http") == -1 || !!storage.data.disabled); 
        
        window.onclick = function(e) {

            switch (e.target.id) {
                case "settings": 
                    openOptionsPage();
                    close();                    
                    break;
                case "allow_site":
                    var parent = perms.testPermission("autoplay", url, true);
                    var start = parent == perms.ALLOW_ACTION ? perms.DENY_ACTION : perms.ALLOW_ACTION;
                    (permission.origin != url.origin || parent.origin || permission != (start + 2) % 4 + 1) ?
                        perms.set("autoplay", url, permission.origin != url.origin ? start : (permission * 2 % 7) % 5) :
                        perms.remove("autoplay", url);
                    storage.commit([permsAutoplayKey]);
                    init();
                    break;
                case "allow_session": 
                    (permission.origin == url.origin && permission == perms.ACCESS_SESSION) ? 
                        perms.remove("autoplay", url) : perms.set("autoplay", url, perms.ACCESS_SESSION);
                    storage.commit([permsAutoplayKey]);
                    init();
                   break;       
                case "disable_site": 
                    var parent = perms.testPermission("flash", url, true);
                    (permissionFlash.origin != url.origin || parent.origin || permissionFlash != Number(parent)) ?
                        perms.set("flash", url, (permissionFlash == perms.ALLOW_ACTION) ? perms.DENY_ACTION : perms.ALLOW_ACTION):
                        perms.remove("flash", url);
                    storage.commit([permsFlashKey]);
                    init();
                   break;       
                case "allow_all":
                    storage.data.disabled = !storage.data.disabled;
                    storage.commit(["disabled"]);
                    init();
                   break;       
            }
        };
    };
    
    function initItem(item, check, args) 
    { 
        if (check !== undefined) check ? item.setAttribute("checked", check) : item.removeAttribute("checked");         
        if (args) { var i = 0; item.textContent = item.textContent.replace(/%S/g, function () { return args[i++]; }); };
    };
};



//</>
