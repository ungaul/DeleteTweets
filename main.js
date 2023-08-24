var authorization = "Bearer ***"; // replace
var ua = navigator.userAgentData.brands.map(brand => `"${brand.brand}";v="${brand.version}"`).join(', ');
var client_tid = "***"; // replace
var client_uuid = "***"; // replace
var csrf_token = getCookie("ct0");
var random_resource = "uYU5M2i12UhDvDTzN6hZPg";
var tweets_to_delete = []
var user_id = getCookie("twid").substring(4);
var username = "***" // replace with your username

function buildAcceptLanguageString() {
	const languages = navigator.languages;

	// Check if we have any languages
	if (!languages || languages.length === 0) {
		return "en-US,en;q=0.9"; // Default value if nothing is available
	}

	let q = 1;
	const decrement = 0.1;

	return languages.map(lang => {
		if (q < 1) {
			const result = `${lang};q=${q.toFixed(1)}`;
			q -= decrement;
			return result;
		}
		q -= decrement;
		return lang;
	}).join(',');
}

function getCookie(name) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
}

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch_tweets(cursor, retry = 0) {
	let count = "20";
	let final_cursor = cursor ? `%22cursor%22%3A%22${cursor}%22%2C` : "";
	var base_url = `https://twitter.com/i/api/graphql/${random_resource}/UserTweetsAndReplies`;

	var variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
	var feature = `&features=%7B%22rweb_lists_timeline_redesign_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
	var final_url = `${base_url}${variable}${feature}`;

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
			"x-twitter-client-language": "fr"
		},
		"referrer": `https://twitter.com/${username}/with_replies`,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": null,
		"method": "GET",
		"mode": "cors",
		"credentials": "include"
	});

	if (!response.ok) {
		if (retry == 5) {
			throw new Error("Max retries reached")
		}
		console.log(`(delete_tweets) Network response was not ok, retrying in ${10 * (1 + retry)} seconds`);
		await sleep(10000 * (1 + retry));
		return fetch_tweets(cursor, retry + 1)
	}
	const data = await response.json();
	const entries = data["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][cursor ? 0 : 1]["entries"];

	console.log(entries);
	return entries;
}

async function log_tweets(entries) {
	for (let item of entries) {
		if (item["entryId"].startsWith("profile-conversation")) {
			findTweetIds(item)
		}
		else if (item["entryId"].startsWith("cursor-bottom") && entries.length > 2) {
			let cursor_bottom = item["content"]["value"];

			return cursor_bottom;
		}
	}
	return "finished"
}

function check_filter(tweet) {
	if (tweet['legacy']['full_text'].includes("filter out this text"))
		return false
	return true
}

function check_tweet_owner(obj, uid) {
	if (obj.hasOwnProperty('legacy') && obj['legacy'].hasOwnProperty('retweeted') && obj['legacy']['retweeted'] === true)
		return false
	if (obj.hasOwnProperty('user_id_str') && obj['user_id_str'] === uid)
		return true;
	else if (obj.hasOwnProperty('legacy') && obj['legacy'].hasOwnProperty('user_id_str') && obj['legacy']['user_id_str'] === uid)
		return true;
	return false
}

function tweetFound(obj) {
	console.log(`found ${obj['legacy']['full_text']}`)
}

function findTweetIds(obj) {
	function recurse(currentObj) {
		if (typeof currentObj !== 'object' || currentObj === null) {
			return;
		}

		if (currentObj['__typename'] === 'TweetWithVisibilityResults' && currentObj.hasOwnProperty('tweet')
			&& check_tweet_owner(currentObj['tweet'], user_id) && check_filter(currentObj['tweet'])) {
			tweets_to_delete.push(currentObj['tweet']['id_str'] || currentObj['tweet']['legacy']['id_str']);
			tweetFound(currentObj['tweet'])
		}

		else if (currentObj.hasOwnProperty('__typename') && currentObj['__typename'] === 'Tweet'
			&& check_tweet_owner(currentObj, user_id) && check_filter(currentObj)) {
			tweets_to_delete.push(currentObj['id_str'] || currentObj['legacy']['id_str']);
			tweetFound(currentObj)
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
	var delete_tid = "LuSa1GYxAMxWEugf+FtQ/wjCAUkipMAU3jpjkil3ujj7oq6munDCtNaMaFmZ8bcm7CaNvi4GIXj32jp7q32nZU8zc5CyLw"
	var id_list_size = id_list.length
	var retry = 0

	for (let i = 0; i < id_list_size; ++i) {
		const response = await fetch("https://twitter.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet", {
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
				"x-twitter-client-language": "fr"
			},
			"referrer": `https://twitter.com/${username}/with_replies`,
			"referrerPolicy": "strict-origin-when-cross-origin",
			"body": `{\"variables\":{\"tweet_id\":\"${id_list[i]}\",\"dark_request\":false},\"queryId\":\"VaenaVgh5q5ih7kvyVjgtg\"}`,
			"method": "POST",
			"mode": "cors",
			"credentials": "include"
		});
		if (!response.ok) {
			if (retry == 5) {
				throw new Error("Max retries reached")
			}
			console.log(response)
			console.log(`(delete_tweets) Network response was not ok, retrying in ${10 * (1 + retry)} seconds`);
			i -= 1;
			await sleep(10000 * (1 + retry));
			continue
		}
		retry = 0
		console.log(`${i}/${id_list_size}`)
		await sleep(100);
	}
	console.log("DELETION COMPLETE")
}

var next = null
var entries = undefined

while (next != "finished") {
	entries = await fetch_tweets(next);
	next = await log_tweets(entries);
	await sleep(2000);
}

await delete_tweets(tweets_to_delete)
