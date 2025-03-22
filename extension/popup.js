$("#startButton").on("click", function () {
    const $startButton = $("#startButton");
    const $status = $("#status");

    $startButton.addClass("active");
    $status.text("Starting deletion process...");

    let options = {
        unretweet: $("#unretweet").prop("checked"),
        min_like_count_to_ignore: $("#minLikes").val() || "0",
        do_not_remove_pinned_tweet: $("#doNotRemovePinned").prop("checked"),
        delete_message_with_url_only: $("#deleteMessageWithUrl").prop("checked"),
        delete_specific_ids_only: ($("#deleteSpecificIds").val() || "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s) || [""],
        match_any_keywords: ($("#matchAnyKeywords").val() || "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s) || [""],
        tweets_to_ignore: ($("#tweetsToIgnore").val() || "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s),
        old_tweets: $("#oldTweets").prop("checked"),
        after_date: $("#afterDate").val() || "",
        before_date: $("#beforeDate").val() || ""
    };

    chrome.runtime.sendMessage({ action: "openXTab" }, function (response) {
        if (!response || !response.tabId) {
            console.error("Could not open x.com tab.");
            $status.text("Error: Could not open x.com tab.");
            $startButton.removeClass("active");
            return;
        }
        let targetTabId = response.tabId;

        setTimeout(function () {
            chrome.runtime.sendMessage({ action: "getCredentials" }, function (creds) {
                console.log("Credentials from background:", creds);

                let capturedUsername = creds.username || "";
                let capturedClientUuid = creds.client_uuid || "t";

                let params = {
                    authorization: creds.authorization,
                    client_tid: creds.client_tid,
                    client_uuid: capturedClientUuid,
                    twitter_username: capturedUsername,
                    options: options
                };

                fetch(chrome.runtime.getURL("main.js"))
                    .then(response => response.text())
                    .then(jsText => {
                        jsText = jsText.replace(/var authorization\s*=\s*".*?"/, `var authorization = "${creds.authorization}"`);
                        jsText = jsText.replace(/var client_tid\s*=\s*".*?"/, `var client_tid = "${creds.client_tid}"`);
                        jsText = jsText.replace(/var client_uuid\s*=\s*".*?"/, `var client_uuid = "${capturedClientUuid}"`);
                        jsText = jsText.replace(/var twitter_username\s*=\s*".*?"/, `var twitter_username = "${capturedUsername}"`);

                        jsText = jsText.replace(/"min_like_count_to_ignore":\s*\d+/, `"min_like_count_to_ignore": ${options.min_like_count_to_ignore}`);
                        jsText = jsText.replace(/"after_date":\s*new Date\(\s*'[^']+'\s*\)/, `"after_date": new Date('${options.after_date}')`);
                        jsText = jsText.replace(/"before_date":\s*new Date\(\s*'[^']+'\s*\)/, `"before_date": new Date('${options.before_date}')`);
                        jsText = jsText.replace(/"unretweet":\s*(true|false)/, `"unretweet": ${options.unretweet}`);
                        jsText = jsText.replace(/"do_not_remove_pinned_tweet":\s*(true|false)/, `"do_not_remove_pinned_tweet": ${options.do_not_remove_pinned_tweet}`);
                        jsText = jsText.replace(/"delete_message_with_url_only":\s*(true|false)/, `"delete_message_with_url_only": ${options.delete_message_with_url_only}`);
                        jsText = jsText.replace(/"old_tweets":\s*(true|false)/, `"old_tweets": ${options.old_tweets}`);

                        if (options.delete_specific_ids_only.length === 0) {
                            options.delete_specific_ids_only = [""];
                        }
                        if (options.match_any_keywords.length === 0) {
                            options.match_any_keywords = [""];
                        }
                        let deleteSpecificIdsStr = "[" + options.delete_specific_ids_only.map(x => `"${x}"`).join(", ") + "]";
                        let matchAnyKeywordsStr = "[" + options.match_any_keywords.map(x => `"${x}"`).join(", ") + "]";
                        let tweetsToIgnoreStr = "[" + options.tweets_to_ignore.map(x => `"${x}"`).join(", ") + "]";

                        jsText = jsText.replace(/"delete_specific_ids_only":\s*\[[^\]]*\]/, `"delete_specific_ids_only": ${deleteSpecificIdsStr}`);
                        jsText = jsText.replace(/"match_any_keywords":\s*\[[^\]]*\]/, `"match_any_keywords": ${matchAnyKeywordsStr}`);
                        jsText = jsText.replace(/"tweets_to_ignore":\s*\[[^\]]*\]/, `"tweets_to_ignore": ${tweetsToIgnoreStr}`);

                        console.log("Generated JS Code:\n", jsText);
                        window.generatedCode = jsText;

                        chrome.scripting.executeScript({
                            target: { tabId: targetTabId },
                            files: ["main.js"]
                        }, function () {
                            if (chrome.runtime.lastError) {
                                console.error("Error injecting main.js:", chrome.runtime.lastError.message);
                                $status.text("Error injecting main.js: " + chrome.runtime.lastError.message);
                                $startButton.removeClass("active");
                                return;
                            }
                            chrome.scripting.executeScript({
                                target: { tabId: targetTabId },
                                function: function (params) {
                                    window.mainScript(params);
                                },
                                args: [params]
                            }, function () {
                                if (chrome.runtime.lastError) {
                                    console.error("Injection error:", chrome.runtime.lastError.message);
                                    $status.text("Injection error: " + chrome.runtime.lastError.message);
                                } else {
                                    console.log("mainScript executed successfully.");
                                    $status.text("[mainScript] Deletion complete.");
                                }
                                $startButton.removeClass("active");
                            });
                        });
                    })
                    .catch(err => {
                        console.error("Error fetching main.js:", err);
                        $status.text("Error fetching main.js: " + err.message);
                        $startButton.removeClass("active");
                    });
            });
        }, 5000);
    });
});