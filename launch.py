import os
import re
import sys
import time
import webbrowser
import pyautogui
import pyperclip
import tkinter as tk
from tkinter import messagebox, simpledialog
from dotenv import load_dotenv, find_dotenv

import ttkbootstrap as tb
from ttkbootstrap.constants import *

# For Windows taskbar icon customization
import win32gui
import win32con

# Global variable for the root window
root = None

def bool_to_js(value):
    return "true" if value else "false"

# Helper: extract all default values from main.js
def get_all_defaults_from_js():
    defaults = {}
    try:
        with open('main.js', 'r', encoding='utf-8') as f:
            js_text = f.read()
        # Use regex to extract defaults for main variables:
        m = re.search(r'var authorization\s*=\s*"([^"]*)"', js_text)
        if m:
            defaults["authorization"] = m.group(1)
        m = re.search(r'var client_tid\s*=\s*"([^"]*)"', js_text)
        if m:
            defaults["client_tid"] = m.group(1)
        m = re.search(r'var twitter_username\s*=\s*"([^"]*)"', js_text)
        if m:
            defaults["TWITTER_USERNAME"] = m.group(1)
        # For delete_options:
        m = re.search(r'"min_like_count_to_ignore":\s*(\d+)', js_text)
        if m:
            defaults["min_like_count_to_ignore"] = int(m.group(1))
        m = re.search(r'"after_date":\s*new Date\(\s*\'([^\']+)\'\s*\)', js_text)
        if m:
            defaults["after_date"] = m.group(1)
        m = re.search(r'"before_date":\s*new Date\(\s*\'([^\']+)\'\s*\)', js_text)
        if m:
            defaults["before_date"] = m.group(1)
        m = re.search(r'"from_archive":\s*(true|false)', js_text)
        if m:
            defaults["from_archive"] = True if m.group(1)=="true" else False
        m = re.search(r'"unretweet":\s*(true|false)', js_text)
        if m:
            defaults["unretweet"] = True if m.group(1)=="true" else False
        m = re.search(r'"do_not_remove_pinned_tweet":\s*(true|false)', js_text)
        if m:
            defaults["do_not_remove_pinned_tweet"] = True if m.group(1)=="true" else False
        m = re.search(r'"delete_message_with_url_only":\s*(true|false)', js_text)
        if m:
            defaults["delete_message_with_url_only"] = True if m.group(1)=="true" else False
        m = re.search(r'"old_tweets":\s*(true|false)', js_text)
        if m:
            defaults["old_tweets"] = True if m.group(1)=="true" else False

        # For arrays, we assume a JSON-like format
        m = re.search(r'"delete_specific_ids_only":\s*(\[[^\]]*\])', js_text)
        if m:
            defaults["delete_specific_ids_only"] = eval(m.group(1))
        m = re.search(r'"match_any_keywords":\s*(\[[^\]]*\])', js_text)
        if m:
            defaults["match_any_keywords"] = eval(m.group(1))
        m = re.search(r'"tweets_to_ignore":\s*(\[[^\]]*\])', js_text, re.DOTALL)
        if m:
            defaults["tweets_to_ignore"] = eval(m.group(1))
    except Exception as e:
        print("Error reading main.js for defaults:", e)
    return defaults

# Try to load credentials from .env (if available)
dotenv_path = find_dotenv()
if dotenv_path:
    load_dotenv(dotenv_path)

# Get defaults from main.js
all_defaults = get_all_defaults_from_js()

# Global credentials: use environment variables if available; otherwise, use JS defaults.
BEARER = os.getenv("BEARER", all_defaults.get("authorization", ""))
CLIENT_TID = os.getenv("CLIENT_TID", all_defaults.get("client_tid", ""))
TWITTER_USERNAME = os.getenv("TWITTER_USERNAME", all_defaults.get("TWITTER_USERNAME", ""))

def toggle_options():
    global options_visible, toggle_button, options_frame, root
    if options_visible:
        options_frame.grid_remove()
        toggle_button.config(text="Show Other Options ▼")
    else:
        options_frame.grid()
        toggle_button.config(text="Hide Other Options ▲")
    options_visible = not options_visible
    root.update_idletasks()
    root.geometry("")

def submit(event=None):
    global BEARER, CLIENT_TID, TWITTER_USERNAME, root
    if not entry_bearer.get().strip():
        messagebox.showerror("Error", "Bearer Token is required.")
        return
    if not entry_client_tid.get().strip():
        messagebox.showerror("Error", "Client TID is required.")
        return
    if not entry_TWITTER_USERNAME.get().strip():
        messagebox.showerror("Error", "Username is required.")
        return

    BEARER = entry_bearer.get().strip()
    CLIENT_TID = entry_client_tid.get().strip()
    TWITTER_USERNAME = entry_TWITTER_USERNAME.get().strip()

    try:
        from_archive = var_from_archive.get()
        unretweet = var_unretweet.get()
        min_like_count = int(entry_min_like.get().strip())
        do_not_remove_pinned = var_do_not_remove.get()
        delete_message_with_url = var_delete_url.get()
        delete_specific_ids = [s.strip() for s in entry_delete_ids.get().split(',') if s.strip()]
        match_any_keywords = [s.strip() for s in entry_match_keywords.get().split(',') if s.strip()]
        tweets_to_ignore = [s.strip() for s in entry_ignore.get().split(',') if s.strip()]
        old_tweets = var_old_tweets.get()
        after_date = entry_after_date.get().strip()
        before_date = entry_before_date.get().strip()
    except Exception as e:
        messagebox.showerror("Error", f"Invalid input in options: {e}")
        return

    options = {
        "from_archive": from_archive,
        "unretweet": unretweet,
        "min_like_count_to_ignore": min_like_count,
        "do_not_remove_pinned_tweet": do_not_remove_pinned,
        "delete_message_with_url_only": delete_message_with_url,
        "delete_specific_ids_only": delete_specific_ids,
        "match_any_keywords": match_any_keywords,
        "tweets_to_ignore": tweets_to_ignore,
        "old_tweets": old_tweets,
        "after_date": after_date,
        "before_date": before_date
    }

    root.destroy()
    process_js(options)

def process_js(options):
    with open('main.js', 'r', encoding='utf-8') as f:
        js_code = f.read()

    # Replace main variable values (match any current value)
    js_code = re.sub(r'var authorization\s*=\s*".*?";', f'var authorization = "Bearer {BEARER}";', js_code)
    js_code = re.sub(r'var client_tid\s*=\s*".*?";', f'var client_tid = "{CLIENT_TID}";', js_code)
    js_code = re.sub(r'(var username\s*=\s*")[^"]*(")', r'\1' + TWITTER_USERNAME + r'\2', js_code)

    # Replace delete_options values (using re.sub so it works regardless of the existing value)
    js_code = re.sub(r'"from_archive":\s*(true|false),', f'"from_archive":{bool_to_js(options["from_archive"])},', js_code)
    js_code = re.sub(r'"unretweet":\s*(true|false),', f'"unretweet":{bool_to_js(options["unretweet"])},', js_code)
    js_code = re.sub(r'"min_like_count_to_ignore":\s*\d+,', f'"min_like_count_to_ignore": {options["min_like_count_to_ignore"]},', js_code)
    js_code = re.sub(r'"do_not_remove_pinned_tweet":\s*(true|false),', f'"do_not_remove_pinned_tweet":{bool_to_js(options["do_not_remove_pinned_tweet"])},', js_code)
    js_code = re.sub(r'"delete_message_with_url_only":\s*(true|false),', f'"delete_message_with_url_only":{bool_to_js(options["delete_message_with_url_only"])},', js_code)
    js_code = re.sub(r'"old_tweets":\s*(true|false),', f'"old_tweets":{bool_to_js(options["old_tweets"])},', js_code)
    js_code = re.sub(r'"after_date":\s*new Date\(\s*\'[^\']+\'\s*\),', f'"after_date":new Date(\'{options["after_date"]}\'),', js_code)
    js_code = re.sub(r'"before_date":\s*new Date\(\s*\'[^\']+\'\s*\)', f'"before_date":new Date(\'{options["before_date"]}\')', js_code)

    # For arrays, your existing replacement may work if they match exactly.
    delete_specific_ids_js = "[" + ", ".join(f'"{x}"' for x in options["delete_specific_ids_only"]) + "]"
    match_any_keywords_js = "[" + ", ".join(f'"{x}"' for x in options["match_any_keywords"]) + "]"
    tweets_to_ignore_js = "[" + ", ".join(f'"{x}"' for x in options["tweets_to_ignore"]) + "]"

    js_code = js_code.replace(
        '"delete_specific_ids_only":[""],',
        f'"delete_specific_ids_only":{delete_specific_ids_js},'
    )
    js_code = js_code.replace(
        '"match_any_keywords":[""],',
        f'"match_any_keywords":{match_any_keywords_js},'
    )
    js_code = js_code.replace(
        '"tweets_to_ignore":[\n\t\t"00000000000000", // these\n\t\t"111111111111111", // ids\n\t\t"222222222222" // are examples, you can safely keep them or replace them by your own ids.\n\t],',
        f'"tweets_to_ignore":{tweets_to_ignore_js},'
    )

    # Handle --gen flag: if present, write to code.js instead of launching browser automation.
    if "--gen" in sys.argv:
        with open("code.js", "w", encoding="utf-8") as f:
            f.write(js_code)
        print("code.js has been generated.")
    else:
        url = f"https://x.com/{TWITTER_USERNAME}"
        webbrowser.open(url, new=2)
        time.sleep(5)
        pyautogui.hotkey('ctrl', 'shift', 'j')
        time.sleep(2)
        pyperclip.copy(js_code)
        time.sleep(1)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(1)
        pyautogui.press('enter')

def launch_gui():
    global root, options_visible, entry_bearer, entry_client_tid, entry_TWITTER_USERNAME
    global toggle_button, options_frame, var_from_archive, var_unretweet
    global entry_min_like, var_do_not_remove, var_delete_url, entry_delete_ids
    global entry_match_keywords, entry_ignore, var_old_tweets, entry_after_date, entry_before_date

    style = tb.Style("darkly")
    root = style.master
    root.title("Twitter JS Injector")
    icon = tk.PhotoImage(file="./assets/icon.png")
    root.iconphoto(True, icon)
    root.update_idletasks()
    root.eval('tk::PlaceWindow . center')
    root.bind("<Return>", submit)

    options_visible = False

    credentials_frame = tb.Labelframe(root, text="Credentials", padding=10, bootstyle="primary")
    credentials_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")

    tb.Label(credentials_frame, text="Bearer Token:").grid(row=0, column=0, sticky="e")
    global entry_bearer
    entry_bearer = tb.Entry(credentials_frame, width=50, bootstyle="info")
    entry_bearer.grid(row=0, column=1, padx=5, pady=5)
    entry_bearer.insert(0, BEARER)

    tb.Label(credentials_frame, text="Client TID:").grid(row=2, column=0, sticky="e")
    global entry_client_tid
    entry_client_tid = tb.Entry(credentials_frame, width=50, bootstyle="info")
    entry_client_tid.grid(row=2, column=1, padx=5, pady=5)
    entry_client_tid.insert(0, CLIENT_TID)

    tb.Label(credentials_frame, text="Username:").grid(row=3, column=0, sticky="e")
    global entry_TWITTER_USERNAME
    entry_TWITTER_USERNAME = tb.Entry(credentials_frame, width=50, bootstyle="info")
    entry_TWITTER_USERNAME.grid(row=3, column=1, padx=5, pady=5)
    entry_TWITTER_USERNAME.insert(0, TWITTER_USERNAME)

    toggle_button = tb.Button(root, text="Show Other Options ▼", command=toggle_options, bootstyle="secondary")
    toggle_button.grid(row=1, column=0, pady=(0,10))

    options_frame = tb.Labelframe(root, text="Other Options", padding=10, bootstyle="info")
    options_frame.grid(row=2, column=0, padx=10, pady=10, sticky="ew")
    options_frame.grid_remove()

    global var_from_archive, var_unretweet
    var_from_archive = tk.BooleanVar(value=all_defaults.get("from_archive") if "from_archive" in all_defaults else False)
    tb.Checkbutton(options_frame, text="From Archive", variable=var_from_archive, bootstyle="round-toggle").grid(row=0, column=0, sticky="w")

    var_unretweet = tk.BooleanVar(value=all_defaults.get("unretweet") if "unretweet" in all_defaults else False)
    tb.Checkbutton(options_frame, text="Unretweet", variable=var_unretweet, bootstyle="round-toggle").grid(row=0, column=1, sticky="w")

    tb.Label(options_frame, text="Min Like Count to Ignore:").grid(row=1, column=0, sticky="e")
    global entry_min_like
    entry_min_like = tb.Entry(options_frame, width=10, bootstyle="info")
    entry_min_like.grid(row=1, column=1, sticky="w", padx=5, pady=5)
    entry_min_like.insert(0, str(all_defaults.get("min_like_count_to_ignore") or ""))

    global var_do_not_remove, var_delete_url
    var_do_not_remove = tk.BooleanVar(value=all_defaults.get("do_not_remove_pinned_tweet") if "do_not_remove_pinned_tweet" in all_defaults else True)
    tb.Checkbutton(options_frame, text="Do Not Remove Pinned Tweet", variable=var_do_not_remove, bootstyle="round-toggle").grid(row=2, column=0, sticky="w")

    var_delete_url = tk.BooleanVar(value=all_defaults.get("delete_message_with_url_only") if "delete_message_with_url_only" in all_defaults else False)
    tb.Checkbutton(options_frame, text="Delete Message With URL Only", variable=var_delete_url, bootstyle="round-toggle").grid(row=2, column=1, sticky="w")

    tb.Label(options_frame, text="Delete Specific IDs Only (comma-separated):").grid(row=3, column=0, sticky="e")
    global entry_delete_ids
    entry_delete_ids = tb.Entry(options_frame, width=50, bootstyle="info")
    entry_delete_ids.grid(row=3, column=1, sticky="w", padx=5, pady=5)
    default_ids = all_defaults.get("delete_specific_ids_only", [])
    entry_delete_ids.insert(0, ", ".join(default_ids) if default_ids and default_ids != [""] else "")

    tb.Label(options_frame, text="Match Any Keywords (comma-separated):").grid(row=4, column=0, sticky="e")
    global entry_match_keywords
    entry_match_keywords = tb.Entry(options_frame, width=50, bootstyle="info")
    entry_match_keywords.grid(row=4, column=1, sticky="w", padx=5, pady=5)
    default_keywords = all_defaults.get("match_any_keywords", [])
    entry_match_keywords.insert(0, ", ".join(default_keywords) if default_keywords and default_keywords != [""] else "")

    tb.Label(options_frame, text="Tweets to Ignore (comma-separated):").grid(row=5, column=0, sticky="e")
    global entry_ignore
    entry_ignore = tb.Entry(options_frame, width=50, bootstyle="info")
    entry_ignore.grid(row=5, column=1, sticky="w", padx=5, pady=5)
    default_ignore = all_defaults.get("tweets_to_ignore", [])
    entry_ignore.insert(0, ", ".join(default_ignore) if default_ignore else "")

    global var_old_tweets
    var_old_tweets = tk.BooleanVar(value=all_defaults.get("old_tweets") if "old_tweets" in all_defaults else False)
    tb.Checkbutton(options_frame, text="Old Tweets", variable=var_old_tweets, bootstyle="round-toggle").grid(row=6, column=0, sticky="w")

    tb.Label(options_frame, text="After Date (YYYY-MM-DD):").grid(row=7, column=0, sticky="e")
    global entry_after_date
    entry_after_date = tb.Entry(options_frame, width=15, bootstyle="info")
    entry_after_date.grid(row=7, column=1, sticky="w", padx=5, pady=5)
    entry_after_date.insert(0, all_defaults.get("after_date") or "")

    tb.Label(options_frame, text="Before Date (YYYY-MM-DD):").grid(row=8, column=0, sticky="e")
    global entry_before_date
    entry_before_date = tb.Entry(options_frame, width=15, bootstyle="info")
    entry_before_date.grid(row=8, column=1, sticky="w", padx=5, pady=5)
    entry_before_date.insert(0, all_defaults.get("before_date") or "")

    submit_button = tb.Button(root, text="Submit", command=submit, bootstyle="success")
    submit_button.grid(row=3, column=0, pady=10)

    root.mainloop()

launch_gui()
