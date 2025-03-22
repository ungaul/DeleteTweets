async function mainScript(params) {
	console.log("[mainScript] Parameters received:", params);
	try {
		var authorization = params.authorization;
		var ua = navigator.userAgentData.brands
			.map(brand => `"${brand.brand}";v="${brand.version}"`)
			.join(', ');
		var client_tid = params.client_tid;
		var client_uuid = params.client_uuid;
		var csrf_token = getCookie("ct0");
		var random_resource = "uYU5M2i12UhDvDTzN6hZPg";
		var random_resource_old_tweets = "H8OOoI-5ZE4NxgRr8lfyWg";
		var language_code = navigator.language.split("-")[0];
		var tweets_to_delete = [];
		var user_id = getCookie("twid").substring(4);
		var username = params.twitter_username;
		var stop_signal = undefined;
		var twitter_archive_content = undefined;
		var twitter_archive_loading_confirmed = false;
		var delete_options = params.options;

		console.log("[mainScript] Initial variables set.");

		if (!(delete_options["after_date"] instanceof Date)) {
			delete_options["after_date"] = new Date(delete_options["after_date"]);
		}
		if (!(delete_options["before_date"] instanceof Date)) {
			delete_options["before_date"] = new Date(delete_options["before_date"]);
		}

		function buildAcceptLanguageString() {
			const languages = navigator.languages;
			if (!languages || languages.length === 0) {
				console.log("[buildAcceptLanguageString] No languages found, defaulting to en-US.");
				return "en-US,en;q=0.9";
			}
			let q = 1;
			const decrement = 0.1;
			const langString = languages.map(lang => {
				const result = q < 1 ? `${lang};q=${q.toFixed(1)}` : lang;
				q -= decrement;
				return result;
			}).join(',');
			console.log("[buildAcceptLanguageString] Built Accept-Language string:", langString);
			return langString;
		}

		function getCookie(name) {
			const value = `; ${document.cookie}`;
			const parts = value.split(`; ${name}=`);
			if (parts.length === 2) {
				const cookieVal = parts.pop().split(';').shift();
				console.log(`[getCookie] Cookie '${name}' found: ${cookieVal}`);
				return cookieVal;
			}
			console.warn(`[getCookie] Cookie '${name}' not found.`);
		}

		async function sleep(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		async function fetch_tweets(cursor, retry = 0) {
			console.log(`[fetch_tweets] Fetching tweets with cursor: ${cursor} | Retry: ${retry}`);
			let count = "20";
			let final_cursor = cursor ? `%22cursor%22%3A%22${cursor}%22%2C` : "";
			let resource = delete_options["old_tweets"] ? random_resource_old_tweets : random_resource;
			let endpoint = delete_options["old_tweets"] ? "UserTweets" : "UserTweetsAndReplies";
			var base_url = `https://x.com/i/api/graphql/${resource}/${endpoint}`;

			var variable = "";
			var feature = "";
			if (delete_options["old_tweets"] == false) {
				variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
				feature = `&features=%7B%22rweb_lists_timeline_redesign_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
			} else {
				variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
				feature = `&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
			}
			var final_url = `${base_url}${variable}${feature}`;
			console.log(`[fetch_tweets] Final URL: ${final_url}`);

			const response = await fetch(final_url, {
				"headers": {
					"accept": "*/*",
					"accept-language": buildAcceptLanguageString(),
					"authorization": authorization,
					"content-type": "application/json",
					"sec-ch-ua": ua,
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": "\"Windows\"",
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "same-origin",
					"x-client-transaction-id": client_tid,
					"x-client-uuid": client_uuid,
					"x-csrf-token": csrf_token,
					"x-twitter-active-user": "yes",
					"x-twitter-auth-type": "OAuth2Session",
					"x-twitter-client-language": language_code
				},
				"referrer": `https://x.com/${username}/with_replies`,
				"referrerPolicy": "strict-origin-when-cross-origin",
				"body": null,
				"method": "GET",
				"mode": "cors",
				"credentials": "include"
			});

			if (!response.ok) {
				console.error(`[fetch_tweets] Response not OK. Status: ${response.status}`);
				if (response.status === 429) {
					console.warn("[fetch_tweets] Rate limit reached. Waiting 1 minute...");
					await sleep(60000);
					return fetch_tweets(cursor, retry + 1);
				}
				if (retry === 5) {
					throw new Error("[fetch_tweets] Max retries reached");
				}
				console.log(`[fetch_tweets] Retrying in ${10 * (1 + retry)} seconds...`);
				console.log(await response.text());
				await sleep(10000 * (1 + retry));
				return fetch_tweets(cursor, retry + 1);
			}
			const data = await response.json();
			console.log("[fetch_tweets] Data received:", data);
			var entries = data["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"];
			for (let item of entries) {
				if (item["type"] == "TimelineAddEntries") {
					entries = item["entries"];
				}
			}
			console.log("[fetch_tweets] Extracted entries:", entries);
			return entries;
		}

		async function log_tweets(entries) {
			console.log("[log_tweets] Logging tweet entries.");
			for (let item of entries) {
				if (item["entryId"].startsWith("profile-conversation") || item["entryId"].startsWith("tweet-")) {
					findTweetIds(item);
				} else if (item["entryId"].startsWith("cursor-bottom") && entries.length > 2) {
					let cursor_bottom = item["content"]["value"];
					console.log("[log_tweets] Cursor found:", cursor_bottom);
					return cursor_bottom;
				}
			}
			console.log("[log_tweets] No further cursor found. Marking as finished.");
			return "finished";
		}

		function check_keywords(text) {
			if (delete_options["match_any_keywords"].length == 0) {
				return true;
			}
			for (let word of delete_options["match_any_keywords"]) {
				if (text.includes(word)) {
					console.log(`[check_keywords] Keyword "${word}" found in text.`);
					return true;
				}
			}
			return false;
		}

		function check_date(tweet) {
			if (tweet['legacy'] && tweet['legacy'].hasOwnProperty('created_at')) {
				let tweet_date = new Date(tweet['legacy']["created_at"]);
				tweet_date.setHours(0, 0, 0, 0);
				if (tweet_date > delete_options["after_date"] && tweet_date < delete_options["before_date"]) {
					return true;
				} else if (tweet_date < delete_options["after_date"]) {
					console.warn("[check_date] Tweet date is before the after_date threshold. Signaling stop.");
					stop_signal = true;
				}
				return false;
			}
			return true;
		}

		function check_date_archive(created_at) {
			let tweet_date = new Date(created_at);
			tweet_date.setHours(0, 0, 0, 0);
			if (tweet_date > delete_options["after_date"] && tweet_date < delete_options["before_date"]) {
				return true;
			} else if (tweet_date < delete_options["after_date"]) {
				console.warn("[check_date_archive] Archive tweet date is before the after_date threshold. Signaling stop.");
				stop_signal = true;
			}
			return false;
		}

		function check_filter(tweet) {
			if (tweet['legacy'] && tweet['legacy'].hasOwnProperty('favorite_count') &&
				tweet['legacy']['favorite_count'] >= delete_options["min_like_count_to_ignore"]) {
				console.log("[check_filter] Tweet skipped due to like count threshold.");
				return false;
			}
			if (tweet['legacy'] && tweet['legacy'].hasOwnProperty('id_str') &&
				(delete_options["tweets_to_ignore"].includes(tweet['legacy']["id_str"]) ||
					delete_options["tweets_to_ignore"].includes(parseInt(tweet['legacy']["id_str"])))) {
				console.log("[check_filter] Tweet skipped because it is in the ignore list.");
				return false;
			}
			if (delete_options["delete_message_with_url_only"] === true) {
				if (tweet['legacy'] && tweet['legacy'].hasOwnProperty('entities') &&
					tweet['legacy']["entities"].hasOwnProperty('urls') &&
					tweet['legacy']["entities"]["urls"].length > 0 &&
					check_keywords(tweet['legacy']['full_text']) &&
					check_date(tweet)) {
					return true;
				}
				return false;
			}
			if (check_keywords(tweet['legacy']['full_text']) && check_date(tweet)) {
				return true;
			}
			return false;
		}

		function check_filter_archive(tweet_obj) {
			if (tweet_obj.hasOwnProperty('favorite_count') &&
				tweet_obj['favorite_count'] >= delete_options["min_like_count_to_ignore"]) {
				console.log("[check_filter_archive] Archive tweet skipped due to like count threshold.");
				return false;
			}
			let tweet_id = tweet_obj["id"];
			let tweet_str = tweet_obj["text"];
			let tweet_date = tweet_obj["date"];
			if (delete_options["tweets_to_ignore"].includes(tweet_id) ||
				delete_options["tweets_to_ignore"].includes(parseInt(tweet_id))) {
				console.log("[check_filter_archive] Archive tweet skipped because it is in the ignore list.");
				return false;
			}
			if (check_keywords(tweet_str) && check_date_archive(tweet_date))
				return true;
			return false;
		}

		function check_tweet_owner(obj, uid) {
			if (obj['legacy'] && obj['legacy'].hasOwnProperty('retweeted') &&
				obj['legacy']['retweeted'] === true && delete_options["unretweet"] == false)
				return false;
			if (obj.hasOwnProperty('user_id_str') && obj['user_id_str'] === uid)
				return true;
			else if (obj['legacy'] && obj['legacy'].hasOwnProperty('user_id_str') && obj['legacy']['user_id_str'] === uid)
				return true;
			return false;
		}

		function tweetFound(obj) {
			console.log("[tweetFound] Found tweet to delete:", obj['legacy']['full_text']);
		}

		function parseTweetsFromArchive(data) {
			console.log("[parseTweetsFromArchive] Parsing tweets from archive data.");
			try {
				const filteredIds = [];
				data.forEach(item => {
					if (item.tweet && item.tweet.id_str) {
						const isInReplyToExcludedUser = item.tweet.in_reply_to_user_id_str === user_id;
						const startsWithRT = item.tweet.full_text.startsWith('RT ');
						let tweet_obj = {
							id: item.tweet.id_str,
							text: item.tweet.full_text,
							date: item.tweet.created_at
						};
						if (!isInReplyToExcludedUser &&
							((delete_options["unretweet"] == true && startsWithRT == true) ||
								(delete_options["unretweet"] == false && startsWithRT == false)) &&
							check_filter_archive(tweet_obj)) {
							// valid tweet for deletion
						} else {
							return;
						}
						console.log("[parseTweetsFromArchive] Deleting tweet:", item.tweet.full_text);
						filteredIds.push(item.tweet.id_str);
					}
				});
				console.log("[parseTweetsFromArchive] Filtered tweet IDs:", filteredIds);
				return filteredIds;
			} catch (error) {
				console.error("[parseTweetsFromArchive] Error parsing JSON:", error);
				return [];
			}
		}

		function findTweetIds(obj) {
			function recurse(currentObj) {
				if (typeof currentObj !== 'object' || currentObj === null ||
					(delete_options["do_not_remove_pinned_tweet"] == true && currentObj['__type'] == "TimelinePinEntry")) {
					return;
				}
				if (currentObj['__typename'] === 'TweetWithVisibilityResults' && currentObj.hasOwnProperty('tweet') &&
					check_tweet_owner(currentObj['tweet'], user_id) && check_filter(currentObj['tweet'])) {
					let tweetId = currentObj['tweet']['id_str'] || currentObj['tweet']['legacy']['id_str'];
					tweets_to_delete.push(tweetId);
					tweetFound(currentObj['tweet']);
				} else if (currentObj.hasOwnProperty('__typename') && currentObj['__typename'] === 'Tweet' &&
					check_tweet_owner(currentObj, user_id) && check_filter(currentObj)) {
					let tweetId = currentObj['id_str'] || currentObj['legacy']['id_str'];
					tweets_to_delete.push(tweetId);
					tweetFound(currentObj);
				}
				for (let key in currentObj) {
					if (currentObj.hasOwnProperty(key)) {
						recurse(currentObj[key]);
					}
				}
			}
			recurse(obj);
		}

		async function delete_tweets(id_list) {
			console.log("[delete_tweets] Starting deletion for IDs:", id_list);
			var delete_tid = "LuSa1GYxAMxWEugf+FtQ/wjCAUkipMAU3jpjkil3ujj7oq6munDCtNaMaFmZ8bcm7CaNvi4GIXj32jp7q32nZU8zc5CyLw";
			var id_list_size = id_list.length;
			var retry = 0;
			for (let i = 0; i < id_list_size; ++i) {
				console.log(`[delete_tweets] Deleting tweet ${i + 1} of ${id_list_size}: ${id_list[i]}`);
				const response = await fetch("https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet", {
					"headers": {
						"accept": "*/*",
						"accept-language": buildAcceptLanguageString(),
						"authorization": authorization,
						"content-type": "application/json",
						"sec-ch-ua": ua,
						"sec-ch-ua-mobile": "?0",
						"sec-ch-ua-platform": "\"Windows\"",
						"sec-fetch-dest": "empty",
						"sec-fetch-mode": "cors",
						"sec-fetch-site": "same-origin",
						"x-client-transaction-id": delete_tid,
						"x-client-uuid": client_uuid,
						"x-csrf-token": csrf_token,
						"x-twitter-active-user": "yes",
						"x-twitter-auth-type": "OAuth2Session",
						"x-twitter-client-language": language_code
					},
					"referrer": `https://x.com/${username}/with_replies`,
					"referrerPolicy": "strict-origin-when-cross-origin",
					"body": `{"variables":{"tweet_id":"${id_list[i]}","dark_request":false},"queryId":"VaenaVgh5q5ih7kvyVjgtg"}`,
					"method": "POST",
					"mode": "cors",
					"credentials": "include"
				});
				if (!response.ok) {
					console.error(`[delete_tweets] Response not OK for tweet ID ${id_list[i]}. Status: ${response.status}`);
					if (response.status === 429) {
						console.warn("[delete_tweets] Rate limit reached. Waiting 1 minute...");
						await sleep(60000);
						i -= 1;
						continue;
					}
					if (retry == 8) {
						throw new Error("[delete_tweets] Max retries reached");
					}
					console.log(await response.text());
					console.log(`[delete_tweets] Retrying in ${10 * (1 + retry)} seconds...`);
					i -= 1;
					await sleep(10000 * (1 + retry));
					continue;
				}
				retry = 0;
				console.log(`[delete_tweets] Successfully deleted tweet ${i + 1} of ${id_list_size}`);
				await sleep(100);
			}
			console.log("[delete_tweets] Deletion process completed for current batch.");
		}

		// Process archive deletion if requested
		var next = null;
		var entries = undefined;
		if (delete_options["from_archive"] == true) {
			console.log("[mainScript] Waiting for Twitter archive file to be loaded by user.");
			// Create modal elements (modal code omitted for brevity, same as before)
			// ... (modal creation and file handling code)
			// The modal will set twitter_archive_loading_confirmed to true upon confirmation
			while (twitter_archive_loading_confirmed == false) {
				console.log("[mainScript] Waiting for archive confirmation...");
				await sleep(1000);
			}
			tweets_to_delete = parseTweetsFromArchive(twitter_archive_content);
			console.log("[mainScript] Tweets to delete from archive:", tweets_to_delete);
			await delete_tweets(tweets_to_delete);
		}
		// Process deletion via fetching tweets if no specific IDs provided
		else if (delete_options["delete_specific_ids_only"].length == 1 && delete_options["delete_specific_ids_only"][0].length == 0) {
			console.log("[mainScript] No specific IDs provided; starting dynamic tweet fetching and deletion.");
			while (next != "finished" && stop_signal != true) {
				entries = await fetch_tweets(next);
				next = await log_tweets(entries);
				await delete_tweets(tweets_to_delete);
				tweets_to_delete = [];
				console.log("[mainScript] Waiting 3 seconds before next fetch...");
				await sleep(3000);
			}
		}
		// Process deletion for specified IDs
		else {
			console.log("[mainScript] Deleting specified tweet IDs:", delete_options["delete_specific_ids_only"]);
			await delete_tweets(delete_options["delete_specific_ids_only"]);
		}
		console.log("[mainScript] Deletion complete.");
	} catch (error) {
		console.error("[mainScript] Error during execution:", error);
	}
}

window.mainScript = mainScript;
console.log("[mainScript] mainScript function is now available.");
