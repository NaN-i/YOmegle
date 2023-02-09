// ==UserScript==
// @name         YOmegle
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  A tampermonkey userscript used to modify and add more features to omegle.
// @author       Yana
// @match        https://www.omegle.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=omegle.com
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    let myIdent = GM_getValue("myIdent");
    let firstIdents = [];
    const eventsURLRe = /https?:\/\/front\d+\.omegle\.com\/(?:start|events)/;

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

    function printOmegleLog(log) {
        const child = document.querySelector("div.logbox").firstChild;
        const div = document.createElement("div");
        const p = document.createElement("p");
        const text = document.createTextNode(log);

        div.className = "logitem";
        p.className = "statuslog";

        p.appendChild(text);
        div.appendChild(p);
        child.appendChild(div);
    }

    function printStrangerIdent(ident, thisIdents) {
        if (!ident) {
            myIdent = null;
            firstIdents = thisIdents;
            GM_setValue("myIdent", myIdent);
            printOmegleLog("Could not get stranger identity because your IP address has changed. Should work next time.");
            return;
        }
        printOmegleLog("Stranger identity: " + ident);
    }

    function getOtherIdent(ident, idents) {
        if (idents.indexOf(ident) == -1) {
            return undefined;
        }
        const otherIdent = idents[0] == myIdent ? idents[1] : idents[0];
        return otherIdent;
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

    (function(handler) {
        window.unsafeWindow.termsLevel = 1;
        handleRequestOpen(handler);
    })(XMLHttpRequest.prototype.open);
})();
