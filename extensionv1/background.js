// Global variable to store the latest header values.
let lastHeaders = {};

// Listen for requests to client_event.json
chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        console.log("onBeforeSendHeaders triggered:", details);
        let auth = "";
        let clientTid = "";
        for (let header of details.requestHeaders) {
            console.log("Header:", header.name, header.value);
            if (header.name.toLowerCase() === "authorization") {
                auth = header.value;
            }
            if (header.name.toLowerCase() === "x-client-transaction-id") {
                clientTid = header.value;
            }
        }
        // Store the header values
        lastHeaders = { authorization: auth, xClientTransactionId: clientTid };
        console.log("Stored headers:", lastHeaders);
    },
    { urls: ["*://x.com/i/api/1.1/jot/client_event.json*"] },
    ["requestHeaders"]
);

// Listen for messages from the popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getHeaders") {
        sendResponse(lastHeaders);
    }
});
