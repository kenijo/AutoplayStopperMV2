

"use strict";

const Options = new function() {

    const {i18n, storage, permissions: perms} = chrome.extension.getBackgroundPage().Background;
    const permsAutoplayKey = perms.key("autoplay");
    const permsAutoplayDefaultKey = perms.defaultKey("autoplay");
    const permsFlashKey = perms.key("flash");
    const permsFlashDefaultKey = perms.defaultKey("flash");
    const data = { flash: { type: "flash", dirty: false}, autoplay: { type: "autoplay", dirty: false}};
    const { autoplay, flash } = data;
    
    var tabId = null;
    var selected = null;
    
//    chrome.tabs.getCurrent(function(tab) { tabId = tab.id; }); // chrome workaround ...
    chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) { tabId = tabs[0].id; }); 
    chrome.tabs.onActivated.addListener(function(info){ if (tabId == info.tabId) postActive(); });
    addEventListener("load", init);
    addEventListener("hashchange", function() { updateState(location.hash.slice(1)); });
         
    function init()
    {
        i18n.process(document);
        var listener = storage.addChangeListener(function(changes){
            if (changes.indexOf(permsAutoplayKey) != -1) {
                autoplay.exceptions.init(perms.entries("autoplay"));
                autoplay.dirty = false;
                updateApply();            
            }
            if(changes.indexOf(permsAutoplayDefaultKey) != -1) {
                document.getElementById("autoplay-default").value = perms.default("autoplay");         
            }
            if (changes.indexOf(permsFlashKey) != -1) {
                flash.exceptions.init(perms.entries("flash"));
                flash.dirty = false;
                updateApply();            
            }
            if(changes.indexOf(permsFlashDefaultKey) != -1) {
                document.getElementById("flash-default").value = perms.default("flash");    
            }             
        });
        addEventListener("unload", function(){ storage.removeChangeListener(listener); });
        
        var manifest = chrome.runtime.getManifest();
        document.getElementById("extension-version").appendChild(document.createTextNode(manifest.version));
        document.getElementById("autoplay-default").value = perms.default("autoplay");
        document.getElementById("flash-default").value = perms.default("flash");
        document.getElementById("devtools").checked = storage.data.devtools;
        autoplay.exceptions = new ExceptionsList(document.getElementById("autoplay-list"));
        autoplay.exceptions.init(perms.entries("autoplay"));
        document.getElementById("autoplay-default").addEventListener("change", function(e) { 
            perms.setDefault("autoplay", e.target.value);
            storage.commit([permsAutoplayDefaultKey]);            
        });
        flash.exceptions = new ExceptionsList(document.getElementById("flash-list"));
        flash.exceptions.init(perms.entries("flash"));
        document.getElementById("flash-default").addEventListener("change", function(e) { 
            perms.setDefault("flash", e.target.value);
            storage.commit([permsFlashDefaultKey]);   
        });
        document.querySelectorAll(".exceptions-list-button").forEach(function(button) { 
            button.onclick = function(e) { location.hash = `${button.getAttribute("contenttype")}`; };
        });
        autoplay.exceptions.addDirtyListener(function(d) { autoplay.dirty = d; updateApply(); });
        flash.exceptions.addDirtyListener(function(d) { flash.dirty = d; updateApply(); });
        document.querySelector(".close-button").onclick = function() { location.hash = ""; };
        document.getElementById("exceptions-clear").onclick = function() { selected.exceptions.clear(); };        
        document.getElementById("exceptions-apply").onclick = apply;
        document.getElementById("exceptions-confirm").onclick = function() { apply(); location.hash = ""; };
        document.getElementById("exceptions-export").onclick = function() {
            var a = document.getElementById("export-link");
            a.download = selected.type + "-exceptions.json";
            var data = encodeURIComponent(JSON.stringify([...selected.exceptions.entries()]));
            a.href = "data:application/json," + data;
            a.click();
        };
        var input = document.getElementById("import-input");
        document.getElementById("exceptions-import").onclick = function() { input.click(); };
        input.onchange = async function() {
            try {
                selected.exceptions.init(JSON.parse(await this.files[0].text()));
                this.value = null;
            } catch(e) {
                chrome.extension.getBackgroundPage()
                    .alert(`${chrome.i18n.getMessage("importError")} ${this.files[0].name}\n${e}`);
            };
        };
        document.getElementById("devtools").onclick = function(e) {
            storage.data.devtools = this.checked;
            storage.commit(["devtools"]);
        };        
        if (location.hash) updateState(location.hash.slice(1));
        postActive();
    };
    
    function postActive() { chrome.extension.getBackgroundPage().postMessage("optionsPageActive", "*"); };    
    function updateApply() { document.getElementById("exceptions-apply").disabled = !selected || !selected.dirty; };   
    
    function apply() 
    {
        if (selected.dirty) {
            perms.clear(selected.type);
            for (var [url, perm] of selected.exceptions.entries()) { perms.set(selected.type, url, perm); };
            storage.commit([perms.key(selected.type)], function(err){
                if (err) { selected.dirty = true; };
                updateApply();
            });
            selected.dirty = false;
        }
    };
    
    function updateState(state)
    {
//        console.log(`updateState(${state})`);
        if (state) {
            document.querySelector("div[contenttype]:not([hidden])").hidden = true;
            document.querySelector("h2[contenttype]:not([hidden])").hidden = true;
            document.querySelector(`div[contenttype=${state}]`).hidden = false;
            document.querySelector(`h2[contenttype=${state}]`).hidden = false;
            var overlay = document.querySelector(".overlay");
            overlay.hidden = false;
            setTimeout(function() { overlay.classList.remove("transparent"); }, 20);
            selected = data[state];
            updateApply();
        }
        else {
            var overlay = document.querySelector(".overlay");
            overlay.classList.add("transparent");
            setTimeout(function() { overlay.hidden = true; }, 500);        
        }            
    }
};

const ExceptionsList = function ExceptionsList(list){
    
    var itemid    = 0;
    var baseitem  = list.querySelector("#listitem");
    var inputitem   = list.querySelector("#inputitem");
    var selected  = list.querySelector("[selected]");
    var listeners = [];
    var dirty     = false;

    baseitem.remove();
    list.addEventListener("mousedown", handleMousedown.bind(this));
    list.addEventListener("click",  handleClick.bind(this));
    list.addEventListener("keydown", handleKeyDown.bind(this));
    list.addEventListener("change", handleChange.bind(this));
    list.addEventListener("focus", function(e) {
        if (!e.target.classList.contains("row-delete-button")) {
            list.setAttribute("has-element-focus", "hasElementFocus");
            handleSelection(e.target.closest("[role=listitem]"));
            if (e.target.getAttribute("displaymode") == "static") e.target.nextSibling.focus();
        }
    }, true);
    list.addEventListener("blur", function(e) {
        if (!list.contains(e.relatedTarget) && !e.target.classList.contains("row-delete-button")) {
            list.removeAttribute("has-element-focus");
            handleSelection();
            if (!e.relatedTarget) list.parentNode.closest("[tabindex]").focus();
        } 
    }, true);
    
    return {
        init: function init(entries) {
            this.clear();
            entries.sort(function(a, b) { return a[0].localeCompare(b[0]); }); 
            for (var [key, type] of entries) { appendItem(key, type); };
            dirty = false;
        },
        entries: function * entries() 
        {             
            for (var node of list.children)
                if (node.id.search("listitem") == 0 && node != inputitem) 
                    yield [node.querySelector("#perms-host").textContent,  parseInt(node.querySelector("#perms-type-select").value)];
        },
        clear: function clear()
        {
            for (var node of [].slice.apply(list.children))
                if (node.id.search("listitem") == 0 && node != inputitem) node.remove();
            inputitem.querySelector("#perms-host-input").focus();
            fireDirty(true);
        },
        get dirty() { return dirty; },
        addDirtyListener: function(listener) { listeners.push(listener); },
        removeDirtyListener: function(listener) { var idx = listeners.indexOf(listener); if (idx != -1) listeners.splice(idx); }
    };    
        
    function appendItem(host, type, scroll)
    {
        var item = baseitem.cloneNode(true);
        item.id = item.id + "-" + (++itemid);        
        item.querySelector("#perms-host-input").value = item.querySelector("#perms-host").textContent = host;
        var select = item.querySelector("#perms-type-select");
        select.value = type;
        if (type != 0) item.querySelector("#perms-type").textContent = select[select.selectedIndex].text;
        list.insertBefore(item, inputitem);
        if (scroll) scrollToBottom(inputitem);
    };
    
    function scrollToBottom(node) 
    {
        if (node.clientHeight < node.scrollHeight) 
            return node.scrollTop = node.scrollHeight - node.clientHeight;
        if (node.parentNode) scrollToBottom(node.parentNode);
    };    
    
    function handleMousedown(e) 
    {
        var target = e.target;
        var item = target.closest("[role=listitem]");
        if (target.classList.contains("row-delete-button")) return;
        if (target.id == "perms-host") {
            var x = e.clientX, y = e.clientY, offset = document.caretPositionFromPoint ? 
                document.caretPositionFromPoint(x, y).offset : document.caretRangeFromPoint(x, y).startOffset;
            var input = item.querySelector("#perms-host-input");
            var inside = x < inputitem.querySelector("#perms-host-input").getBoundingClientRect().right;
            input.selectionStart = input.selectionEnd = inside ? 0 : input.value.length;
            setTimeout(function() { input.selectionStart = input.selectionEnd = offset; }, 25);
        }
        if (item && !target.hasAttribute("tabindex") && !item.hasAttribute("editing")) { 
            item.querySelector("[id^=perms-host]").focus();
            e.preventDefault();
        };
    };
    
    function handleSelection(item)
    {
        if (selected && item != selected) {
            selected.removeAttribute("lead");
            selected.removeAttribute("editing");
            if (item) selected.removeAttribute("selected");
            if (selected == inputitem) handleInput(!item);
            selected.querySelectorAll("[id^=perms]").forEach(function(a) { a.tabIndex = item ? -1 : 0; });
        }
        if (item && !item.hasAttribute("editing")) {
            item.setAttribute("selected", "selected");
            item.setAttribute("lead", "lead");
            item.setAttribute("editing", "");
            item.querySelectorAll("[id^=perms]")
                .forEach(function(a) { a.tabIndex = a.getAttribute("displaymode") == "static" ? -1 : 0; });
            selected = item;
        }
    };
    
    function handleClick(e) 
    {
        var target = e.target;
        if (target.classList.contains("row-delete-button")) {
            var item = target.closest("[role=listitem]");
            if (item == selected) handleSelection(inputitem);
            item.remove();
            list.focus({preventScroll: true});
            fireDirty(true);
            return;
        };
    };    

    function handleKeyDown(e) 
    {
        if (selected &&  selected != inputitem && e.target.id != "perms-host-input" && e.keyCode == 46)
            selected.querySelector(".row-delete-button").click();
        if (selected && e.key == "Enter") selected == inputitem ? handleInput(true) : list.focus({preventScroll: true});
        if (selected && e.key == "ArrowUp" && e.target.id != "perms-type-select" && selected != list.querySelector("[role=listitem]"))
            selected.previousSibling.querySelector("[id^=perms-host]").focus();
        if (selected && e.key == "ArrowDown" && e.target.id != "perms-type-select" && selected != inputitem)
            selected.nextSibling.querySelector("[id^=perms-host]").focus();
    };

    function handleChange(e)
    {
        var target = e.target;
        var item = target.closest("[role=listitem]");
        if (item != inputitem) {
            if (target.id == "perms-type-select") {
                item.querySelector("#perms-type").textContent = 
                    target.value != 0 ? target[target.selectedIndex].text : "";
                fireDirty(true);
            }
            if (target.id == "perms-host-input"){
                try { 
                    var url = new URL(target.value);
                    target.value = url.origin;
                    item.querySelector("#perms-host").textContent = target.value;
                    fireDirty(true);
                } 
                catch (e) { target.value = item.querySelector("#perms-host").textContent; };
            }
        }
    };
    
    function handleInput(scroll)
    {
        try { 
            var target = inputitem.querySelector("#perms-host-input")
            var url = new URL(target.value);
            target.value = url.origin;
            appendItem(target.value, inputitem.querySelector("#perms-type-select").value, scroll);
            target.value = null;
            fireDirty(true);
        } 
        catch (e) {};
    };

    function fireDirty(d) { dirty = d; for (var listener of listeners) listener(d); };
};

//    </>