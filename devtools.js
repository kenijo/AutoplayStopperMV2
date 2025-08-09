

"use strict";

const DevTools = new function() {

    const sArea = "local";
    const sKeys = ["debug", "devtools", "codefile", "ucodefile", "codefilename", "ucodefilename", "disableOverwrite", "selector-css", "uhandler", "handler"];

    document.documentElement.classList.add("theme-" + chrome.devtools.panels.themeName);
    
    var storage = new Storage(sKeys, sArea); 
    storage.ready.then(function() { 
    
        if (!storage.data.devtools) 
            return; 
                                    //  devtools page - create panel ...
        if (location.search == "?view=page")
            return chrome.devtools.panels.create("AutoplayStopper", "/icons/icon48.png", "/skin/devtools.html?view=panel");
            
                                    //  devtools panel ...
        var fileinput = Object.assign(document.createElement("input"), {type: "file", hidden: true});
        document.body.appendChild(fileinput);        
        document.readyState == "complete" ? load() : addEventListener("load", load);

        function load() {
        
            i18n.process(document);
            document.getElementById("ver").textContent = chrome.runtime.getManifest().version;
            setCheckbox("overwrite", "disableOverwrite");
            setCheckbox("debug");
            setSelector();
            setup("");
            setup("u");
        };
        
        function setSelector() 
        {
            var selector = document.getElementById("selector");
            var apply = document.getElementById("apply");
            selector.value = storage.data["selector-css"];
            selector.oninput = function() { apply.disabled = selector.value == storage.data["selector-css"]; };
            apply.onclick = function() {
                storage.data["selector-css"] = selector.value;
                storage.commit(["selector-css"]);
                apply.disabled = true;
            };
            document.getElementById("reset").onclick = function() {
                var url = chrome.extension.getURL("script/selector.css");
                chrome.runtime.sendMessage({ msg: "load", script: "selector-css", file: url });
            };
            storage.addChangeListener(function(changes){
                if (changes.includes("selector-css")) selector.value = storage.data["selector-css"];
                apply.disabled = true;
            });
        };

        function setup(pfx) 
        {
            var file = pfx + "codefile";
            var filename = file + "name";
                        
            document.getElementById(pfx + "path-input").textContent = storage.data[file];
            document.getElementById(pfx + "filename").textContent = storage.data[filename];
            updateState();
            
            document.getElementById(pfx + "load-button").onclick = function() {
                var url = storage.data[file] || chrome.extension.getURL("script/") + (pfx && "user") + "handler.js";
                chrome.runtime.sendMessage({ msg: "load", script: pfx + "handler", file: url});
            };
            document.getElementById(pfx + "export-button").onclick = function() {
                var a = document.getElementById("export-link");
                a.download = (pfx && "user") + "handler.js";
                a.href = "data:application/javascript," + encodeURIComponent(storage.data[pfx + "handler"]);
                a.click();
            };
            document.getElementById(pfx + "edit-button").onclick = function() { 
                var open = chrome.devtools.panels.openResource || function(){};
                open(getURL(file), null, function(res){
                    if (res.isError && res.code == "E_NOTFOUND")
                        alert(chrome.i18n.getMessage("fileNotFound"));
                });
            };
            var committed = chrome.devtools && chrome.devtools.inspectedWindow.onResourceContentCommitted;
            committed && committed.addListener(function(resource){
                if (resource.url == getURL(file))
                    resource.getContent(function(content, encoding) {
                        chrome.devtools.inspectedWindow.eval(content, function(result, isException) {
                            if (isException)
                                alert(chrome.i18n.getMessage("evalError") + isException.value);      
                        });
                    });
            });        
            document.getElementById(pfx + "path-input").oninput = updateState;
            document.getElementById(pfx + "path-button").onclick = function(e) {
                storage.data[filename] = document.getElementById(pfx + "filename").textContent = "";
                storage.data[file] = document.getElementById(pfx + "path-input").textContent;
                storage.commit([file, filename]);
                updateState();
            };
            document.getElementById(pfx + "select-button").onclick = function(e) {
                fileinput.onchange = function() {
                    if (!chrome.extension.getBackgroundPage) {    // fff...
                        var data = {msg: "select", url: URL.createObjectURL(this.files[0])};
                        chrome.runtime.sendMessage(data, function(res) { updateSelected(res.url, res.name); });
                    }
                    else {
                        var url = chrome.extension.getBackgroundPage().URL.createObjectURL(this.files[0]);
                        updateSelected(url, this.files[0].name);
                    }
                };
                fileinput.click();
            };
            
            function updateSelected(url, name) {
                storage.data[file] = document.getElementById(pfx + "path-input").textContent = url;
                storage.data[filename] = document.getElementById(pfx + "filename").textContent = name;
                storage.commit([file, filename]);                    
                updateState();
            };

            function updateState() 
            {
                var a = document.getElementById(pfx + "path-input").textContent == (storage.data[file] || "");
                document.getElementById(pfx + "path-button").disabled = a;
                document.getElementById(pfx + "load-button").disabled = !a;
                document.getElementById(pfx + "edit-button").disabled =  !a || !storage.data[file];        
            };
        };
        
        function getURL(file) { try { return new URL(storage.data[file]).href } catch(e) {}; };

        function setCheckbox(id, key = id) 
        {
            var node = document.getElementById(id);
            node.checked = !!storage.data[key];
            node.onchange = function() {
                storage.data[key] = this.checked;
                storage.commit([key]);
            };                
        };
    });
};

//</>