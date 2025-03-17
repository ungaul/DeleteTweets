console.log("Background script loaded.");

let backgroundTabId = null;
let lastSuccessfulCredentials = {};

function openOrFocusXTab(callback) {
    if (backgroundTabId) {
        chrome.tabs.get(backgroundTabId, function (tab) {
            if (chrome.runtime.lastError || !tab) {
                createXTab(callback);
            } else {
                callback(backgroundTabId);
            }
        });
    } else {
        createXTab(callback);
    }
}

function createXTab(callback) {
    chrome.tabs.create({ url: "https://x.com/home", active: false }, function (tab) {
        backgroundTabId = tab.id;
        console.log("Opened hidden X.com tab with ID:", tab.id);
        callback(tab.id);
    });
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        let authHeader = "";
        let clientTid = "";
        let clientUuid = "";

        for (let header of details.requestHeaders) {
            const name = header.name.toLowerCase();
            if (name === "authorization") {
                authHeader = header.value;
            }
            if (name === "x-client-transaction-id") {
                clientTid = header.value;
            }
            if (name === "x-client-uuid") {
                clientUuid = header.value;
            }
        }

        if (authHeader && clientTid) {
            let newCredentials = {
                authorization: authHeader,
                client_tid: clientTid,
                client_uuid: clientUuid || "t"
            };

            if (JSON.stringify(newCredentials) !== JSON.stringify(lastSuccessfulCredentials)) {
                lastSuccessfulCredentials = newCredentials;
                chrome.storage.local.set({ credentials: newCredentials }, function () {
                    console.log("Stored new credentials:", newCredentials);
                });
            }
        } else {
            console.warn("No valid credentials captured from this request.");
        }
    },
    { urls: ["*://x.com/*", "*://api.x.com/*"] },
    ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getCredentials") {
        chrome.storage.local.get("credentials", function (data) {
            if (!data || !data.credentials) {
                console.warn("No credentials found.");
                sendResponse(undefined);
            } else {
                console.log("Sending credentials to popup:", data.credentials);
                sendResponse(data.credentials);
            }
        });
        return true;
    }
    if (message.action === "openXTab") {
        openOrFocusXTab(function (tabId) {
            sendResponse({ tabId: tabId });
        });
        return true;
    }
});
