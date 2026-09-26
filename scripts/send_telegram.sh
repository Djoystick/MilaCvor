#!/bin/bash
set -e

PHOTO="$1"
CAPTION_FILE="$2"
CHAT_ID="${3:-6208918931}"
BOT_TOKEN="${4:-8227351240:AAFpH-Jbaw48MAJt9J7rYMCKTcrDgGFN6kE}"

if [ -f "$CAPTION_FILE" ]; then
    CAPTION_TEXT=$(cat "$CAPTION_FILE")
else
    CAPTION_TEXT="$CAPTION_FILE"
fi

if [ -n "$PHOTO" ] && [ -f "$PHOTO" ]; then
    curl -s -m 20 --resolve api.telegram.org:443:149.154.167.220 \
        -F "chat_id=$CHAT_ID" \
        -F "photo=@$PHOTO" \
        -F "parse_mode=HTML" \
        --form-string "caption=$CAPTION_TEXT" \
        "https://api.telegram.org/bot$BOT_TOKEN/sendPhoto"
else
    curl -s -m 20 --resolve api.telegram.org:443:149.154.167.220 \
        -d "chat_id=$CHAT_ID" \
        -d "parse_mode=HTML" \
        --data-urlencode "text=$CAPTION_TEXT" \
        "https://api.telegram.org/bot$BOT_TOKEN/sendMessage"
fi

# Clean temporary files if they are in /tmp
case "$PHOTO" in
    /tmp/*) rm -f "$PHOTO" ;;
esac
case "$CAPTION_FILE" in
    /tmp/*) rm -f "$CAPTION_FILE" ;;
esac
