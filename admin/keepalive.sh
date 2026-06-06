#!/usr/bin/env bash
# Daily ping to keep the Supabase project from auto-pausing (free tier pauses
# after ~1 week of inactivity). Installed on the EC2 box via crontab:
#   0 6 * * * /home/ubuntu/autochore-admin/keepalive.sh
URL="https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/chores?select=label&limit=1"
KEY="sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: $KEY" "$URL")
echo "$(date -u +%FT%TZ) keepalive HTTP $CODE" >> /home/ubuntu/autochore-admin/keepalive.log
