document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.sendMessage({ action: "getHeaders" }, function (response) {
        const pre = document.getElementById("headers");
        if (response && response.authorization) {
            pre.textContent = "Authorization: " + response.authorization + "\n" +
                "X-Client-Transaction-Id: " + response.xClientTransactionId;
        } else {
            pre.textContent = "No header values captured yet.";
        }
    });
});
