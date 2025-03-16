document.getElementById("startButton").addEventListener("click", function () {
    let options = {
        unretweet: document.getElementById("unretweet").checked,
        min_like_count_to_ignore: document.getElementById("minLikes").value || "0",
        do_not_remove_pinned_tweet: document.getElementById("doNotRemovePinned").checked,
        delete_message_with_url_only: document.getElementById("deleteMessageWithUrl").checked,
        delete_specific_ids_only: (document.getElementById("deleteSpecificIds").value || "").split(",").map(s => s.trim()).filter(s => s) || [""],
        match_any_keywords: (document.getElementById("matchAnyKeywords").value || "").split(",").map(s => s.trim()).filter(s => s) || [""],
        tweets_to_ignore: (document.getElementById("tweetsToIgnore").value || "").split(",").map(s => s.trim()).filter(s => s),
        old_tweets: document.getElementById("oldTweets").checked,
        after_date: document.getElementById("afterDate").value || "",
        before_date: document.getElementById("beforeDate").value || ""
    };

    // Demande au background d'ouvrir ou focaliser l'onglet x.com
    chrome.runtime.sendMessage({ action: "openXTab" }, function (response) {
        if (!response || !response.tabId) {
            console.error("Could not open x.com tab.");
            return;
        }
        let targetTabId = response.tabId;

        // Attendre 5 secondes pour que le background intercepte la requête et récupère les credentials
        setTimeout(function () {
            chrome.runtime.sendMessage({ action: "getCredentials" }, function (creds) {
                console.log("Credentials from background:", creds);
                alert("Captured credentials:\n" + JSON.stringify(creds, null, 2));
                if (!creds || !creds.authorization) {
                    alert("Credentials not captured. Please ensure you are logged in on x.com.");
                    return;
                }

                let capturedUsername = creds.username || "";
                let capturedClientUuid = creds.client_uuid || "t";

                // Préparer l'objet params à transmettre à mainScript
                let params = {
                    authorization: creds.authorization,
                    client_tid: creds.client_tid,
                    client_uuid: capturedClientUuid,
                    twitter_username: capturedUsername,
                    options: options
                };

                // Récupérer main.js sous forme de texte, effectuer les remplacements,
                // et stocker le code généré dans window.generatedCode
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

                        // Injecter main.js dans l'onglet cible (pour définir window.mainScript)
                        chrome.scripting.executeScript({
                            target: { tabId: targetTabId },
                            files: ["main.js"]
                        }, function () {
                            if (chrome.runtime.lastError) {
                                console.error("Error injecting main.js:", chrome.runtime.lastError.message);
                                return;
                            }
                            // Puis appeler mainScript avec les paramètres, via window.mainScript
                            chrome.scripting.executeScript({
                                target: { tabId: targetTabId },
                                function: function (params) {
                                    window.mainScript(params);
                                },
                                args: [params]
                            }, function () {
                                if (chrome.runtime.lastError) {
                                    console.error("Injection error:", chrome.runtime.lastError.message);
                                } else {
                                    console.log("mainScript executed successfully.");
                                }
                            });
                        });
                    })
                    .catch(err => {
                        console.error("Error fetching main.js:", err);
                    });
            });
        }, 5000); // Délai de 5 secondes
    });
});
