// ==UserScript==
// @name         YOmegle
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  A tampermonkey userscript used to modify and add more features to omegle.
// @author       Yana
// @match        https://www.omegle.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=omegle.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.3/jquery.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';
    GM_addStyle(" \
        #savePopupContainer { \
            display: inline-block; \
            position: relative; \
            margin: 5px; \
            box-shadow: rgb(6 24 44 / 40%) 0px 0px 0px 2px, rgb(6 24 44 / 65%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset; \
        } \
        #savePopupContainer input { \
            margin-left: 2em; \
            margin-top: 2em; \
            margin-bottom: 2em; \
        } \
        #savePopupContainer button { \
            margin-right: 2em; \
            margin-top: 2em; \
            margin-bottom: 2em; \
        } \
        #savePopupContainer p { \
            margin: 1px; \
            font-size: 12px; \
        } \
    ");

    let myIdent = GM_getValue("myIdent");
    let strangerIdent;
    let firstIdents = [];
    const eventsURLRe = /https?:\/\/front\d+\.omegle\.com\/(?:start|events)/;
    
    function wait(interval) { return new Promise(resolve => setTimeout(resolve, interval)); }

    function generateRandID() {
        let b = '';
        for (let a = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', c = 0; 8 > c; c++) {
            let d = Math.floor(Math.random() * a.length);
            b += a.charAt(d);
        }
        return b;
    }

    function newIdentity() {
        // window.randID = generateRandID();
    }

    async function printOmegleLog(log, isIdent = false) {
        const child = document.querySelector("div.logbox").lastChild;
        const div = document.createElement("div");
        const p = document.createElement("p");
        const text = document.createTextNode(log);
        const saveSpan = document.createElement("span");

        div.className = "logitem";
        p.className = "statuslog";
        p.style.display = "inline";
        saveSpan.id = "saveSpan";

        p.appendChild(text);
        div.appendChild(p);
        div.appendChild(saveSpan);
        child.appendChild(div);

        if (isIdent) {
            const container = $(" \
                <div id=\"savePopupContainer\"> \
                    <input type=\"text\" id=\"name\" maxlength=\"20\" placeholder=\"alias\"></input> \
                    <button id=\"saveBtn\">Set</button> \
                    <p>I will remember the alias for this stranger.</p> \
                </div> \
            ").hide();

            $(child).append(container);

            const saveSpanJNode = $("#saveSpan");

            saveSpanJNode.append(" \
                <button id=\"promptSaveBtn\">S</button> \
            ");

            saveSpanJNode.append(" \
                <button id=\"promptDeleteBtn\">R</button> \
            ");
            if (!GM_getValue(strangerIdent)) {
                $("#promptDeleteBtn").hide();
            }

            $("#promptSaveBtn").click(() => {
                $("#savePopupContainer").toggle();
                $("input#name").focus();
            });

            $("#promptDeleteBtn").click(() => {
                GM_deleteValue(strangerIdent);
                $("#promptDeleteBtn").hide();
                p.innerText = "Stranger identity: " + strangerIdent;
            });

            $("#name").keypress(e => {
                if (e.which == 13) {
                    $("#saveBtn").click();
                }
            });

            $("#saveBtn").click(() => {
                const name = $("#name").val();
                if (name) {
                    GM_setValue(strangerIdent, name);
                    $("#promptDeleteBtn").show();
                    p.innerText = "Stranger identity: " + name;
                }
            });
        }
    }

    function printStrangerIdent(ident, thisIdents) {
        if (!ident) {
            myIdent = null;
            firstIdents = thisIdents;
            GM_setValue("myIdent", myIdent);
            printOmegleLog("Could not get stranger identity because your IP address has changed. Should work next time.");
            return;
        }
        printOmegleLog("Stranger identity: " + ident, true);
    }

    function getOtherIdent(ident, idents) {
        if (idents.indexOf(ident) == -1) {
            return undefined;
        }
        strangerIdent = idents[0] == myIdent ? idents[1] : idents[0];
        return GM_getValue(strangerIdent) || strangerIdent;
    }

    function handleIdents(idents) {
        if (myIdent) {
            const strangerIdent = getOtherIdent(myIdent, idents);
            printStrangerIdent(strangerIdent, idents);
            return;
        }

        if (!firstIdents.length) {
            firstIdents = idents;
            printOmegleLog("Stranger identities should (hopefully) show next time you connect.");
            return;
        }

        const firstIdentIdx = firstIdents.indexOf(idents[0]);
        const secondIdentIdx = firstIdents.indexOf(idents[1]);

        if (firstIdentIdx + secondIdentIdx > 0) return;

        myIdent = firstIdentIdx >= 0 ? idents[0] : idents[1];
        GM_setValue("myIdent", myIdent);

        const strangerIdent = getOtherIdent(myIdent, idents);
        printStrangerIdent(strangerIdent, idents);
    }

    function handleEvent(parsedEvent) {
        switch (parsedEvent[0]) {
            case "identDigests":
                {
                    const identsArr = parsedEvent[1].split(",");
                    handleIdents([ identsArr[0], identsArr[2] ]);
                }
                break;

            case "strangerDisconnected":
                newIdentity();
                break;
        }
    }

    function handleEvents(parsedEvents) {
        parsedEvents.forEach(pe => handleEvent(pe));
    }

    function prepareEventsForParsing(res) {
        let parsedEvents;
        try {
            parsedEvents = JSON.parse(res);
        } catch (ex) {
            return null;
        }

        if ("events" in parsedEvents) {
            parsedEvents = parsedEvents.events;
        }

        handleEvents(parsedEvents);
    }

    function handleRequest(req) {
        if (req.readyState != 4 || !req.response) {
            return;
        }

        if (req.responseURL.endsWith("/disconnect")) {
            newIdentity();
            return;
        }

        if (req.responseURL.match(eventsURLRe)) {
            prepareEventsForParsing(req.responseText);
        }
    }

    function handleReadyStateChange(obj) {
        obj.addEventListener("readystatechange", function() {
            handleRequest(obj);
        }, false);
    }

    function isBlacklisted(args) {
        if (args[1].endsWith("/stoplookingforcommonlikes")) return true;
    }

    function handleRequestOpen(originalHandler) {
        XMLHttpRequest.prototype.open = function() {
            if (isBlacklisted(arguments)) return;
            handleReadyStateChange(this);
            originalHandler.apply(this, arguments);
        }
    }

    function isUnwantedEvent(obj, args) {
        if (obj == document && args[0] == "keydown") {
            return true;
        }
    }

    (function(handler) {
        window.unsafeWindow.termsLevel = 1;
        handleRequestOpen(handler);
    })(XMLHttpRequest.prototype.open);

    (function(handler) {
        EventTarget.prototype.addEventListener = function() {
            if (isUnwantedEvent(this, arguments)) return;
            handler.apply(this, arguments);
        }
    })(EventTarget.prototype.addEventListener);
})();
