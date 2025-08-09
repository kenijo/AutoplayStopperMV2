"use strict";

function registerHandlers(handlers, TRACE, isHandlingUserInput, setHandlingUserInput, lastUserInput, data = {})
{     
    var dummyid = Math.floor(Math.random() * 100);

    function testUserInput(el, delay)
    {    
        var win = el.ownerDocument.defaultView, _last = lastUserInput(win), e = _last && _last.e;
        if (!e || Date.now() - _last.time > delay) return false;
        var px = e.pageX - win.scrollX, py = win.scrollY ? e.pageY - win.scrollY : e.clientY, r = el.getBoundingClientRect(), {width ,height} = r;
        for (var i = 0; i < 5 && el.parentNode && (r.top + win.scrollY < 0 || r.left + win.scrollX < 0 || r.width < 10 || r.height < 10); i++) r = (el = el.parentNode).getBoundingClientRect();
        r.width = Math.max(r.width, width), r.height = Math.max(r.height, height);
        return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
    };
                                     // htmlmedia
    handlers.add(function handleHtmlMedia(aElement){
    
        const simEvents = {play: 0, playing: 50, pause: 350}, eventTypes = Object.keys(simEvents), props = ["preload","autoplay","poster","setAttribute","removeAttribute"];
        const document = aElement.ownerDocument, window = document.defaultView;
        if (aElement.localName == "video" || aElement.localName == "audio")
        {
            aElement.id || (aElement.id = "dummyid" + (++dummyid % 100));
            TRACE('handleElement html5 media - tag: %s id: %s autoplay: %s preload: "%s" poster: %s paused: %s')(aElement.localName, aElement.id, aElement.autoplay, aElement.preload, !!aElement.poster, aElement.paused);
            if (aElement.wrappedJSObject.play !== window.wrappedJSObject.HTMLMediaElement.prototype.play) TRACE('handleElement html5 media - %s.play() != HTMLMediaElement.play !!!')(aElement.id);
                                                                               // Yendifplayer  .autoplay = 1 => ...
            var autoplay = aElement.autoplay || !aElement.paused, count = 0, released = false;
            Object.defineProperties(aElement.wrappedJSObject, { preload: {configurable: true, set: (a) => TRACE('%s.preload = "%s"')(aElement.id, a)/* || (aElement.preload = "metadata")*/, get: () => aElement.preload}
                , autoplay: {configurable: true, set: (a) => TRACE("%s.autoplay = %s")(aElement.id, a) || (a && aElement.wrappedJSObject.play()), get: () => aElement.autoplay}});
            aElement.wrappedJSObject.setAttribute = (a, b) => (props.indexOf(a) != -1) ? TRACE("%s.setAttribute(%s, %s)")(aElement.id, a, b) || (aElement.wrappedJSObject[a] = b): aElement.setAttribute(a, b);
            aElement.wrappedJSObject.removeAttribute = (a) => (props.indexOf(a) != -1) ? TRACE("%s.removeAttribute(%s)")(aElement.id, a) : aElement.removeAttribute(a);

            function simPlay(e) {
                e && aElement.removeEventListener(e.type, simPlay);
                if (aElement.simPlay !== false && aElement.paused)
                    eventTypes.forEach((key) => window.setTimeout(() => !released && (TRACE("simPlay - %s.%s")(aElement.id, key) || aElement.dispatchEvent(new window.Event(key))), simEvents[key]));
            };

            var play = aElement.wrappedJSObject.play = () => {
                var force = aElement.allowPlay || testUserInput(aElement, 5000);
                var userInput = isHandlingUserInput(window);
                TRACE("%s.play(%s) - force: %s state: %s user: %s")(aElement.id, count, !!force, aElement.readyState, userInput);
                if (!userInput && !force && !(released && !aElement.paused)) {
                    count++ == 0 && (aElement.preload = "metadata") && (aElement.simPlay || aElement.readyState >= 2 ? simPlay() : aElement.addEventListener("loadeddata", simPlay));
                    return data.strict || count < 5 ? Promise.reject(new window.DOMException("The play method is not allowed by the user agent.", "NotAllowedError")) : simPlay() || Promise.resolve();
                }
                released = data.strict || delete aElement.wrappedJSObject.play;   // jwplayer: zapiks.fr rottentomatoes baeblemusic
                force && !userInput && setHandlingUserInput(window);
                return aElement.play();
            };
            window.wrappedJSObject.Object.defineProperty(aElement.wrappedJSObject.play, "toString", window.Object.assign(window.Object(), {value: () => "[native code]"}));
            aElement.autoplay = false;
            aElement.preload != "none" && (aElement.preload = "metadata");    // mediaelement.js
            aElement.addEventListener("play", function cleanup(e){ e.isTrusted && !aElement.paused &&
                (released || aElement.wrappedJSObject.play == play || testUserInput(aElement, 5000) || aElement.pause()) && (aElement.muted = false, TRACE("%s released...")(aElement.id),
                released = data.strict || (aElement.removeEventListener("play", cleanup), props.forEach((prop) => delete aElement.wrappedJSObject[prop]), delete aElement.wrappedJSObject.play))});
            autoplay && aElement.wrappedJSObject.play();   // flowplayer
            !aElement.paused ? !released && aElement.pause() : window.setTimeout(() => !released && aElement.pause(), 0); // dbtv.no html5box
        };
    });
                                     // simplay
    const hosts = [{host: "cnn.com$", val: true}, {host: "twitch.tv$"}, {host: "yastatic.net$"},
            {host: "bbc.(com|co.uk)$"}, {host: "(yahoo|yimg).com$", class: "html5-video", val: true}, {class: "\\b(video-js|vjs-tech)\\b"}];
    handlers.add(function handleSimplay(aElement){
        if (aElement.localName == "video") 
            for (var a of hosts) if (aElement.ownerDocument.location.hostname.match(a.host) && aElement.className.match(a.class)) aElement.simPlay = !!a.val;
    });
                                     // YouTube
    handlers.add(function handleYouTube(aElement){

        const document = aElement.ownerDocument, window = document.defaultView, jsWin = window.wrappedJSObject;
        if (document.location.hostname.search("\.youtube(-nocookie)?\.com$") != -1)
        {
            TRACE("handleElement ytplayer - tag: %s player: %s")(aElement.localName, aElement.id);
            if (document.location.search.search("feature=youtube-anywhere-player") == -1)
            {
                function stopPlayer(ytplayer){
                    if (testUserInput(ytplayer, 5000)) return !TRACE("ytplayer released...")();
                    var vid = ytplayer.getVideoData && ytplayer.getVideoData().video_id;
                    TRACE("ytplayer stopPlayer(%s) - videoId: %s t: %s")(ytplayer.id || "", vid, ytplayer.getCurrentTime());
                    ytplayer.cueVideoById(vid, ytplayer.getCurrentTime());
                    var nop = false, _seekTo = ytplayer.seekTo, _playVideo = ytplayer.playVideo;
                    ytplayer.playVideo = function doNothing() { nop || (nop = testUserInput(ytplayer, 1000)) ? _playVideo.apply(this) : TRACE("@@@@@@ ytplayer doNothing @@@@@")()};
                    ytplayer.seekTo = function seekTo(tm) { nop || (nop = testUserInput(ytplayer, 1000)) ? _seekTo.apply(this, arguments) : ytplayer.cueVideoById(vid, tm), TRACE("ytplayer seekTo(%s)")(tm); };
                    function onstate(a) { if (a == 1) { nop = true; ytplayer.playVideo = _playVideo; ytplayer.seekTo = _seekTo; TRACE("ytplayer - removed doNothing")(); ytplayer.removeEventListener("onStateChange", onstate); }};
                    ytplayer.addEventListener("onStateChange", onstate);
                }
                if (aElement.localName == "video" && aElement.parentNode.classList.contains("html5-video-container")) {
                    if (!data.strict && aElement.parentNode.parentNode.id == "movie_player")
                        window.addEventListener("click", () => aElement.allowPlay = true, {once: true, capture: true});
                    aElement.simPlay = false;
                    if (aElement.parentNode.parentNode.classList.contains("html5-video-player"))
                        window.setTimeout(() => stopPlayer(aElement.wrappedJSObject.parentNode.parentNode));
                    try { window.wrappedJSObject.ytcsi.tick("pbs", null, "")} catch(e){};
                }
            }
            return true;
        }
    });      
                                 // googleads
    handlers.add(function handleGoogleAds(aElement){
        const document = aElement.ownerDocument, window = document.defaultView;
        var host = aElement.getRootNode().host;
        if (host && host.localName == "lima-video") {
            TRACE("handleElement googleads - tag: %s")(aElement.localName);
            window.addEventListener("visibilitychange", (e) => e.stopPropagation(), true);
            aElement.wrappedJSObject.addEventListener("play", function(){ if (!testUserInput(this, 100)) this.pause()}, {once: true});
            return true;
        }
    });
                                 // msn.com
    handlers.add(function handleMsn(aElement){

        const document = aElement.ownerDocument, window = document.defaultView, jsWin = window.wrappedJSObject;
        if (document.location.hostname.search(/\.msn\.com$/) != -1)
        {
            var obj = aElement.wrappedJSObject;
            if (aElement.className.indexOf("vxFlashPlayer") != -1 && aElement.localName == "embed"){
                obj.MsnVideoCallback = function(msg) { msg == "playVideo" ? delete obj.MsnVideoCallback : obj.__proto__.MsnVideoCallback.apply(obj, arguments)};
                var flashvars = (aElement.getAttribute("flashvars") || "").replace(/(&ap=)true/gi, "$1false")
                aElement.setAttribute("flashvars", flashvars);
                TRACE("handleElement msnplayer - tag: %s id: %s ")(aElement.localName, aElement.id);
                return true;
            }
        }
    });
                                  // BBC
    handlers.add(function handleBBC(aElement){

        const document = aElement.ownerDocument, window = document.defaultView, jsWin = window.wrappedJSObject;
        if (jsWin.embeddedMedia && jsWin.embeddedMedia.players)
            for (var player of jsWin.embeddedMedia.players || []) if (player._swf && player._swf.id == aElement.id) {
                TRACE("handleElement BBC - embeddedMedia.players id: %s autoplay: %s")(player._swf.id, player._settings.autoplay);
                Object.defineProperty(player._settings, "autoplay", {get: () => false});
                player.setData = (info) => ( info.data && (info.data.autoPlayFirstItem = false), player.__proto__.setData.call(player, info));
                window.setTimeout(function(){ player._settings.autoplay = true; handlers.remove(window, handleBBC); }, 2500);
                return true;
            };
    });
                                  // metacafe
    handlers.add(function handleMetacafe(aElement){

        if (aElement.localName == "object" && (aElement.data || "").search(/s.mcstatic.com\/Flash\/.*\.swf/) != -1)
        {
            var param = aElement.querySelector("#" + aElement.id + ">param[name=flashvars]");
            param.value = param.value.replace(/&beacons=.*(?=&)/,"");
            var id = param.value.match(/itemID=([^&]*)(?=&)/)[1];
            var data = aElement.data;
            aElement.data = "http://www.metacafe.com/fplayer/" + id + "/.swf";
            function onClick(aEvent){
                aEvent.stopImmediatePropagation();
                aElement.removeEventListener(aEvent.type, onClick, true);
                aElement.data = data;
            }
            aElement.addEventListener("mouseup", onClick, true);
            TRACE("handleElement metacafe - data: %s")(aElement.data);
            return true;
        }
    });
                                  // jwplayer
    handlers.add(function handleJWPlayer(aElement){  // return;

        const document = aElement.ownerDocument, window = document.defaultView, jsWin = window.wrappedJSObject;
        aElement.id ||  (aElement.id = "dummyid" + (++dummyid % 100));
        if (jsWin.jwplayer && !aElement.querySelector("[id='" + aElement.id + "']>param[name=flashvars]"))
        {
            if (testUserInput(aElement, 5000)) return !TRACE("jwplayer released...")();
            function closest(node, selector) { while(node && !node.matches(selector)) node = node.parentElement; return node};
            var res, ar, player = jsWin.jwplayer(aElement).config ?
                jsWin.jwplayer(aElement) : (res = closest(aElement, ".jwplayer")) ? jsWin.jwplayer(res) : null;
            
            if (player && (player.config || (player.config = player.getConfig())) && player.config.autostart != false)
            {
                TRACE("handleElement jwplayer setup - id: %s autostart: %s")(player.id, player.config.autostart);

                aElement.simPlay = false;
                player.config.autoStart = player.config.autostart = false;
                (ar = player.config.aspectratio) && ar.indexOf("%") != -1 && (player.config.aspectratio = "100:" + ar.slice(0,-1));
                if (player.setConfig) 
                    player.setConfig({autostart: false});
                else  {
                    aElement.localName == "video" && window.setTimeout(() => aElement.src = "");
                    player.setup(player.config);
                }
            }
            TRACE("handleElement jwplayer - id: %s config: %s")((player && player.id), !!(player && player.config));
            return player && player.config;
        }
    });
                                 // flowplayer
    handlers.add(function handleFlowplayer(aElement){ //return;

        aElement.id ||  (aElement.id = "dummyid" + (++dummyid % 100));
        var param = aElement.querySelector("[id='" + aElement.id + "']>param[name=flashvars]")
        var config, flashvars = param ? param.value : aElement.getAttribute("flashvars");
        if (flashvars && flashvars.search(/^config={/) != -1)
            if ((config = JSON.parse(flashvars.slice(7).replace(/'/g,'"').replace(/("autoPlay":)true/g,"$1false"))) && (config.playlist || config.clip))
            {
                var playlist = (config.playlist = (config.playlist || [config.clip]));
                (typeof playlist[0] == 'string') && (playlist[0] = {url: playlist[0]});
                playlist[0].autoPlay = (typeof playlist[0].url == 'string' && playlist[0].url.search(/(.png|.jpg)/) != -1);
                (playlist[0].autoBuffering && (playlist[0].autoBuffering = false)) || (playlist[0].autoPlay && playlist[1] && (playlist[1].autoPlay = false));
                flashvars = "config=" + JSON.stringify(config);
                param ? param.value = flashvars : aElement.setAttribute("flashvars", flashvars);
                if (aElement.data) aElement.data = aElement.data;
                TRACE("handleElement flowplayer - id: %s flashvars: %s")(aElement.id, flashvars);
                return true;
            }
    }); 
                                  // aol
    handlers.add(function handleAol(aElement){

        if (aElement.localName == "object" && (aElement.data || "").search(/cdn(-ssl)?.vidible.tv\/.*\.swf/) != -1)
        {
            aElement.id ||  (aElement.id = "dummyid" + (++dummyid % 100));
            var param = aElement.querySelector("[id='" + aElement.id + "']>param[name=flashvars]");
            if (param)
            {
               param.value = param.value.replace(/(initialization%22%3A%22)autoplay/, "$1click");
               aElement.wrappedJSObject.doPlay = function() { TRACE("doNothing - doPlay")()};
               aElement.ownerDocument.defaultView.setTimeout(() => {delete aElement.wrappedJSObject.doPlay; TRACE("handleElement aol - removed doPlay")()}, 5000);
               return !TRACE("handleElement aol - data: %s")(aElement.data);
            }
        }
    });
                                   // general
    var colValues = {"true":"false", "1":"0", "yes":"no", "on":"off", "y":"n", "Y":"N"}
    function replace(match,p0,p1,p2) {
        var res = p0 + (!p1 && p2 && colValues[p2] ? colValues[p2] : !!p1);
        TRACE(">>> handleElement replace - match: %s p0: %s p1: %s p2: %s res: %s <<<")(match, p0, p1, p2, res);
        return res;
    }
    function modifyParams(str) { return (str || "").replace(/((no)?auto_?(?:play|start|run)\w*(?:["']?\s?[=:]\s?["']?|%22%3A(?!\W)))(true|1|yes|y|on|null|)(?=\W|$)/gi, replace)};

    function handleGeneral(aElement){

        if (aElement.localName != "object" && aElement.localName != "embed")
            return;
        
        var data = modifyParams(aElement.getAttribute("data"));      
        if (data != aElement.getAttribute("data") && data != "")
        {
            aElement.setAttribute("data", data);
            TRACE("handleElement - %s.data: %s")(aElement.localName, data);
        }

        var flashvars = modifyParams(aElement.getAttribute("flashvars")); // cnn | (remove) neulion nhl embed
        if (aElement.localName == "embed" )
        {
            aElement.setAttribute("menu","true");

            if (flashvars == aElement.getAttribute("flashvars") || flashvars == "" )
            {
                flashvars += "&autoplay=false&autostart=false&autoPlay=0";      // youtube(autoplay) | ustream live
                aElement.setAttribute("play","false");		// basic flash
            }
            aElement.setAttribute("flashvars", flashvars);
            if (aElement.src)
            {
                var src = modifyParams(aElement.src);   // embed dailymotion
                if (src != aElement.src) {
                    aElement.src = src;
                    var parent = aElement.parentNode, next = aElement.nextSibling; // workaround for chrome embed.src =
                    if (aElement.src && parent) { aElement.remove(); parent.insertBefore(aElement.wrappedJSObject, next); };
                    TRACE("handleElement embed.src: %s")(src);
                }
            }
        }

        aElement.id ||  (aElement.id = "dummyid" + (++dummyid % 100));   // [id =''] works with numeric ids!!!
        var param = aElement.querySelector("[id='" + aElement.id + "']>param[name=flashvars], [id='" + aElement.id + "']>param[name=FlashVars], [id='" + aElement.id + "']>param[name=flashVars]");
        if (param)
        {
            flashvars = modifyParams(param.value); // ustream(autoplay=false) | bbc / metacafe.embed(no) / tv.com(vid)
            if (flashvars == param.value) {
                if (flashvars.search(/auto(_?play(vid)?|start|run)["']?\s?[=:]/i) != -1) return;   // false already exists...
	            flashvars += "&autoplay=false&autoPlay=0&autoStart=0&_autoPlay=no&auto_start=off"; // justin.tv(autoPlay=0)|nba.com(autostart)|espn(!autoplay)|discovery(_autoPlay=no)|56.com(auto_start)
	        }
            param.value = flashvars;
            if (aElement.data) aElement.data = aElement.data;
        }
        (param = aElement.querySelector("[id='" + aElement.id + "']>param[name=play]")) && (param.value = false);
        if (param && aElement.data) aElement.data = aElement.data;        
        TRACE("handleElement - id: %s %s.flashvars: %s")(aElement.id, aElement.localName, flashvars);
    };

    handlers.add(handleGeneral);
};