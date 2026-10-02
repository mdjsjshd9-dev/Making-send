# WhatsApp Gemini Bot (Railway)

WhatsApp par Gemini AI se auto reply karne wala bot, saath me **scheduled messages** (roz subah 6:00 good morning, raat 10:00 good night, etc.) aur mobile-friendly control panel. Sab kuch Railway **Variables** se ya seedha **WhatsApp chat** se control hota hai.

## Features
- Gemini AI auto reply (Hindi / English / Hinglish), chat ki history yaad rakhta hai
- **Fallback models**: main Gemini model busy ya fail ho to bot khud dusra model try karta hai
- Web page par pairing code, mobile friendly
- Scheduled messages (variables se ya WhatsApp chat se), AI-generated messages bhi
- **AI messages repeat nahi hote**: `ai:` wale schedule me bot pichle messages yaad rakhkar har baar naya likhta hai
- **Auto retry + alert**: schedule na jaye to bot 3 baar dobara try karta hai, phir bhi fail ho to aapko WhatsApp par alert bhejta hai
- Panel se Auto reply / Scheduler ON-OFF aur "Abhi bhejo" test button
- Allowed / blocked numbers list
- **WhatsApp chat se poora bot control** (Railway ya web panel me jaye bina)
- **Schedule preview**: bheje bina dekho ki AI message kaisa banega (`!preview`)
- **Group ID nikaalna aur groups me schedule bhejna** (`!gid`)
- **Spam / ban se bachav**: har chat par reply limit, insaani jaisa gap, purane aur duplicate messages ignore
- **Call reply**: WhatsApp call uthayi to shukriya message, na uthayi to maafi + samasya puchhta hai (aur aapko alert bhejta hai)
- **Photo samajhna**: koi photo bheje to Gemini use dekh kar reply karta hai
- Session Railway Volume me save, redeploy par dobara link nahi karna padta
- **🎙 Plus (naya)**: bot bol bhi sakta hai (Gemini TTS voice note), voice note sunkar samajhta hai, call aane par **approve / cancel** poochta hai, repeat call par khud sambhalta hai, PDF / video padhta hai, sticker, reminder, mausam aur bahut kuch. Poori list neeche **Plus features** section me hai.

## Repo me kaun si file kya karti hai
| File | Kaam |
|---|---|
| `index.js` | Poora bot (WhatsApp, Gemini, scheduler, commands, web panel) |
| `plus.js` | **Naya.** Voice (TTS), call approval, media, tools, `/plus` panel. `index.js` ise khud load karta hai, dono file saath chahiye |
| `package.json` | Dependencies (Baileys, Express, Pino), Node 20+ |
| `Dockerfile` | Railway par build karne ke liye (git: Baileys ki dependency GitHub se aati hai, ffmpeg: voice note aur sticker banane ke liye) |
| `railway.json` | Railway deploy settings: Dockerfile build, `/health` healthcheck, fail hone par auto restart (max 10 baar) |
| `.gitignore`, `.dockerignore` | Faltu files upload/build hone se rokte hain |
| `README.md` | Ye guide |

## Mobile se setup (sirf phone se)

### 1. GitHub repo banao
1. Phone browser me github.com kholo, login karo, **Desktop site** on karo.
2. **New repository** banao (Private rakhna better hai).
3. **Add file → Upload files** se ye files upload karo: `index.js`, `plus.js`, `package.json`, `Dockerfile`, `railway.json`, `.gitignore`, `.dockerignore`, `README.md`.
4. **Commit changes** dabao.

### 2. Railway par deploy
1. railway.app kholo, GitHub se login karo.
2. **New Project → Deploy from GitHub repo** → apna repo chuno.
3. Deploy hone do (Dockerfile automatically use hoga).

### 3. Volume lagao (bahut zaroori)
Service → **Settings → Volumes (ya Add Volume)** → mount path: `/data`
Iske bina har redeploy par WhatsApp dobara link karna padega, aur chat se kiye gaye schedules/settings bhi ud jayenge. Volume na ho to logs me `VOLUME NAHI LAGA` likha aata hai aur `!status` me bhi dikhta hai.

### 4. Variables daalo
Service → **Variables** me ye daalo:

| Variable | Kaam | Example |
|---|---|---|
| `PHONE_NUMBER` | Bot wala WhatsApp number (country code ke saath, bina +) | `919876543210` |
| `ADMIN_PASSWORD` | Panel ka password | `mypass123` |
| `GEMINI_API_KEY` | Google AI Studio se API key | `AIza...` |

`ADMIN_PASSWORD` set nahi hoga to panel "503" dikhayega.

### 5. Domain aur pairing
1. Service → **Settings → Networking → Generate Domain**.
2. Domain kholo, password poocha jaye to koi bhi username + `ADMIN_PASSWORD` daalo.
3. Pairing code dikhega. WhatsApp → **Linked Devices → Link with phone number instead** → code daalo.
4. "✅ WhatsApp connected" dikhe to ho gaya.

Code kuch der me expire ho jata hai, bot khud naya code bana leta hai aur page apne aap refresh hota hai.

## Variables (advance)

| Variable | Default | Kaam |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `GEMINI_FALLBACK_MODELS` | `gemini-2.5-flash-lite,gemini-2.0-flash` | Main model busy / limit / 404 par ye models ek-ek karke try hote hain (comma se alag) |
| `SYSTEM_PROMPT` | friendly assistant | Bot ka style / personality |
| `TIMEZONE` | `Asia/Kolkata` | Schedule ka timezone (galat naam diya to `Asia/Kolkata` chalega) |
| `AUTO_REPLY` | `true` | `false` karo to sirf schedule chalega, reply nahi |
| `REPLY_IN_GROUPS` | `false` | `true` = groups me bhi reply |
| `ALLOWED_NUMBERS` | khali | Sirf inhi numbers ko reply (comma se alag). Khali = sabko |
| `BLOCKED_NUMBERS` | khali | Inko kabhi reply nahi |
| `HISTORY_LIMIT` | `12` | Kitne purane messages yaad rakhe (kam se kam 2) |
| `MAX_REPLIES_PER_MIN` | `6` | Ek chat ko 1 minute me max itne AI reply. Isse zyada aaye to bot chup rehta hai (spam / loop se bachav) |
| `CALL_REPLY` | `true` | `false` = call aane par koi message nahi |
| `CALL_ANSWERED_MSG` | shukriya wala message | Call uthane par jo bhejna ho |
| `CALL_MISSED_MSG` | maafi + samasya puchne wala | Call na uthane par jo bhejna ho |
| `CALL_COOLDOWN_SEC` | `120` | Ek number ko itni der tak dobara call-message nahi (baar-baar call par spam se bachav) |
| `SCHEDULER` | `on` | `off` = saare schedules band |
| `SCHEDULE_TARGETS` | `PHONE_NUMBER` | Schedule kin numbers ko jaye (comma se alag) |
| `SCHEDULE_CATCHUP_MIN` | `10` | Bot down tha to itne minute tak late bhej dega |
| `SEND_DELAY_MS` | `3000` | Do numbers ke beech gap (ban risk kam, kam se kam 1000) |
| `OWNER_NUMBERS` | khali | Jin numbers se WhatsApp par bot control ho sake (comma se alag). `OWNER_NUMBER` naam bhi chalega |
| `DATA_DIR` | `/data` (Volume ho to), warna `.` | Settings aur session yahan save hote hain. Aam taur par mat chhedo |
| `AUTH_DIR` | `DATA_DIR/auth` | WhatsApp session folder. Aam taur par mat chhedo |

Note: `SCHEDULE_TARGETS` ya schedule me number na diya ho to message bot ke apne number par ("Message yourself" chat) jayega. Doosron ko bhejne ke liye unke numbers daalo.

## Scheduled messages

Har schedule ek alag variable hai: `SCHEDULE_1`, `SCHEDULE_2`, `SCHEDULE_3` ...

Format:
```
HH:MM | message | numbers (optional) | days (optional)
```

Examples:
```
SCHEDULE_1 = 06:00 | Good morning ☀️ Aapka din shubh ho!
SCHEDULE_2 = 22:00 | Good night 🌙 Sweet dreams!
SCHEDULE_3 = 13:00 | Khana kha liya? | 919812345678 | mon,tue,wed
SCHEDULE_4 = 08:00 | ai: Ek chhota motivational message likho, aaj {day} hai | self | weekdays
SCHEDULE_5 = 07:00,19:00 | Paani piyo 💧
```

Rules:
- Time 24 ghante format me (`22:00` = raat 10 baje).
- Ek schedule me kai time: `07:00,19:00`.
- `numbers`: comma se alag. Khali chhodo to default target (`SCHEDULE_TARGETS`, wo bhi na ho to bot ka apna number). `self` likhne par hamesha bot ka apna number ("Message yourself" chat). Group ke liye poori group ID (`...@g.us`) bhi chalegi, ID `!gid` se milti hai.
- `days`: `all`, `weekdays`, `weekend`, ya `mon,tue,wed,thu,fri,sat,sun`.
- Message ke andar `|` mat use karo (wo alag field maana jata hai).
- Message `ai:` se shuru ho to Gemini har baar naya message likhega, aur pichle ~15-20 messages yaad rakhkar repeat nahi karega.
- Placeholders: `{date}`, `{day}`, `{time}`.
- Galat format wala schedule skip ho jata hai, logs me likha aata hai.
- Variable badalne ke baad Railway apne aap redeploy karta hai.

**Retry aur alert**
- Schedule na jaye (WhatsApp disconnect, Gemini fail, etc.) to bot 1 minute baad dobara try karta hai, kul 3 baar.
- 3 baar fail hone par bot aapke "Message yourself" chat me `🤖 ⚠️` wala alert bhejta hai. Tab `!test N` ya logs se check karo.
- Bot band/down tha to `SCHEDULE_CATCHUP_MIN` minute tak ka missed schedule late bhej deta hai. Usse zyada late ho to skip.
- Ek din me ek schedule ek hi baar jata hai (redeploy par dobara nahi, agar Volume laga hai).

## WhatsApp se control (Railway me jaye bina)

Bot ko WhatsApp chat se hi control kar sakte ho. Commands `!` ya `/` se shuru hote hain. Bot har jawab `🤖` se shuru karta hai.

**Control chat kaise kholein (2 tareeke)**
1. **"Message yourself" chat**: bot jis number par linked hai usi ke apne chat me `!help` likho. Kuch set nahi karna.
2. **Alag number se**: Railway Variables me `OWNER_NUMBERS=919876543210` (aapka personal number, comma se kai) daalo. Phir bot ka number phone me **"Unbout"** (ya koi bhi naam) se save karo, aur us chat me `!help` likho. Chat usi naam se dikhega.

Sirf `OWNER_NUMBERS` wale numbers aur bot ka apna chat hi commands chala sakte hain (owner ke commands sirf personal chat me chalte hain, group me nahi). Baaki log `!` likhen to bot use normal message samajhkar AI reply deta hai.

**Commands**

| Command | Kaam |
|---|---|
| `!help` | Menu (`!menu`, `!h` bhi) |
| `!status` | Bot ka haal: connection, time, auto reply, schedules, model, uptime, Volume |
| `!reply on/off` | AI auto reply |
| `!groups on/off` | Groups me reply |
| `!prompt` | Abhi ki personality dekho |
| `!prompt <text>` / `!prompt reset` | Bot ki personality badlo / wapas default |
| `!model` / `!model <naam>` / `!model reset` | Gemini model dekho / badlo / default |
| `!clear` | Chat history saaf |
| `!allow add/del/list/clear/reset <number>` | Sirf inko reply |
| `!block add/del/list/clear/reset <number>` | Inko reply nahi |
| `!schedules` | Saare schedules (number ke saath) |
| `!add 06:00 \| Good morning \| numbers \| days` | Naya schedule |
| `!del N` | Chat se banaya schedule hatao |
| `!off N` / `!on N` | Schedule pause / chalu |
| `!test N` | Abhi bhejo (targets ko jayega) |
| `!preview N` | AI message kaisa banega dekho, kisi ko bheje bina |
| `!scheduler on/off` | Saare schedules on/off |
| `!targets 9198..,9199..` / `!targets reset` | Schedule kin numbers ko jaye |
| `!tz Asia/Kolkata` / `!tz reset` | Timezone |
| `!gid` | Bot ke saare groups ki naam + ID list (`!groupids` bhi) |
| `!send <number ya group-ID> <message>` | Kisi ko ya group ko abhi message bhejo |
| `!restart` | Bot restart |

`on/off` ki jagah `chalu / band / haan / nahi` bhi likh sakte ho.

Example:
```
!add 06:00 | Good morning ☀️
!add 22:00 | Good night 🌙
!add 08:00 | ai: motivational message likho, aaj {day} hai | self | weekdays
!preview 3
!off 2
```

Chat se kiye gaye badlav `/data` Volume me save hote hain aur Railway Variables se **upar** chalte hain. `reset` likhne par wapas Variables wali value chalu ho jaati hai. Railway ke `SCHEDULE_n` wale schedules `!del` se nahi hatte, unhe `!off N` se band karo.

`!restart` ke baad bot 20-30 second me wapas aata hai. Railway max 10 baar auto restart karta hai (`railway.json`), isliye `!restart` baar-baar mat chalao.

## Call aur Photo

- **Call**: bot jab chal raha ho aur aapke number par WhatsApp call aaye. Call uthayi to `CALL_ANSWERED_MSG`, na uthayi (ya cut kar di) to `CALL_MISSED_MSG` jata hai aur aapko "Missed call" alert milta hai. Group call par kuch nahi hota. Chat se `!calls on/off`. Approve wala naya system alag hai, neeche **Plus features → Calls** dekho (`!callmode off` karoge to sirf ye purana tareeka chalega).
- **Photo**: koi photo (caption ke saath ya bina) bheje to bot use dekh kar reply karta hai. 8 MB se badi photo ya jo download na ho, uske liye bot dobara bhejne ko kehta hai.
- Call kaise pakdi gayi ye Railway logs me `call event:` wali lines me dikhta hai.

## 🎙 Plus features (voice, calls, tools)

Ye sab `plus.js` me hain. Menu dekhne ke liye bot ke chat me `!plus` likho. Panel: `https://<aapka-domain>/plus`.

### Call kaise kaam karti hai (zaroori)
WhatsApp ki **live call me bot bol nahi sakta** (Baileys call ka audio support nahi karta). Isliye:
- Call aaye to aapke "Message yourself" chat me prompt aata hai: **1 = approve, 2 = cancel** (panel `/plus` me bhi buttons hain)
- **Approve**: bot call reject karke caller ko **voice note** bhejta hai aur voice chat shuru ho jati hai (caller voice note ya text bheje, bot voice me jawab de)
- **Cancel**: bot bilkul hat jata hai, koi message nahi jata
- Jawab na do to `CALL_APPROVAL_SEC` ke baad default chalta hai (`ignore` = purana missed-call message)
- Call kat gayi aur `REPEAT_CALL_MIN` (10 min) ke andar **dobara aayi** to bot bina poochhe khud sambhalta hai
- Asli live call me baat ke liye Meta ka WhatsApp Business Calling API chahiye (alag setup aur approval)

### Plus variables (sab optional)
| Variable | Default | Kaam |
|---|---|---|
| `TTS_VOICE` | `Kore` | Bot ki awaaz (30 options, `!voice` se list) |
| `REPLY_MODE` | `text` | `text` / `voice` / `both` |
| `CALL_APPROVAL_SEC` | `25` | Approve ka jawab dene ka time |
| `CALL_APPROVAL_DEFAULT` | `ignore` | Time khatam hone par: `ignore` ya `auto` (khud baat kare) |
| `REPEAT_CALL_MIN` | `10` | Itne minute me dobara call aaye to auto-answer |
| `VOICE_SESSION_MIN` | `10` | Voice chat itni der shant rahe to khatam + aapko summary |
| `CALL_GREETING` | default greeting | Approve ke baad caller ko jo voice note jaye |
| `CALL_REJECT_ON_APPROVE` | `true` | `false` = call ringing chhod do, sirf voice note bhejo |
| `PUBLIC_CMDS` | `true` | `false` = `!tts`, `!weather` jaise commands sirf aap chala sako |
| `FLOOD_LIMIT` | `25` | 1 minute me itne se zyada message bheje to 1 ghante ignore |
| `BROADCAST_MAX` | `30` | `!bc` se ek baar me max itne log |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | Awaaz wala model |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | `!imagine` wala model |

### Kya-kya naya hai
- **Voice**: voice note reply (Gemini TTS), voice note sunkar jawab, 30 awaazein, tone, text/voice/both mode, voice ka jawab voice me (mirror), `!say`, `!sayto`, scheduled voice, TTS fail ho to text, panel me awaaz sunna aur voice inbox
- **Calls**: approve/cancel, repeat call auto-answer, approval timeout, VIP list, DND time, call log, custom greeting, voice chat khatam hone par summary, panel buttons
- **Media**: PDF padhna, video samajhna, location bhejne par mausam, `!sticker`, `!imagine`, `!ocr`, `!poll`
- **AI**: personas, language lock, knowledge base, busy mode, naye logon ko welcome, `!tr`, `!summary`, user ka naam yaad
- **Tools**: `!weather`, `!calc`, `!remind`, `!note`, `!joke`
- **Admin**: flood auto-block, `!stats`, daily report, `!bc`, blue tick aur typing delay on/off, restart ke baad bhi history yaad

### Plus commands
Owner ke commands (aapke chat me):

| Command | Kaam |
|---|---|
| `!plus` | Poora menu |
| `!say <text>` | Apne chat me voice note |
| `!sayto <number> <text>` | Kisi ko voice note |
| `!voice` / `!voice Puck` | Awaaz list / badlo |
| `!tone <style>` / `!tone reset` | Bolne ka andaaz (jaise `cheerfully`) |
| `!mode text\|voice\|both [number]` | Sabke liye ya ek number ke liye reply mode |
| `!mirror on/off` | Voice aaye to voice me jawab |
| `!callmode ask\|auto\|off` | ask = approve poochega, auto = khud uthayega, off = sirf purana tareeka |
| `!approve [id]` / `!cancel [id]` | Call approve / cancel (ya seedha `1` / `2` likho) |
| `!callvip add/del/list <number>` | In numbers ki call hamesha auto-answer |
| `!callgreet <text>` / `reset` | Call ke baad jo bola jaye |
| `!calllog` | Pichli calls |
| `!sessions` / `!endvoice [number\|all]` | Chalti voice chats dekho / band karo |
| `!dnd 23:00-07:00` / `!dnd off` | Is time approval nahi poochega, bot khud call sambhalega |
| `!persona [naam]` | friendly, teacher, funny, formal, shayar, support, coach |
| `!lang hindi\|english\|hinglish\|auto` | Jawab ki bhasha |
| `!kb add/del/list/clear` | Bot ko jaankari / FAQ do |
| `!busy <wajah>` / `!busy off` | Bot logon ko batayega ki aap busy ho |
| `!welcome <text>` / `off` | Naye logon ko pehla message |
| `!summary [number]` | Chat ka summary |
| `!imagine <prompt>` | Image banao |
| `!remind 30m \| text` / `!remind 18:30 \| text` / `list` / `del N` | Yaad dilao |
| `!note <text>` / `!note list/del N/clear` | Notes |
| `!poll Sawal \| a \| b \| c` | Poll |
| `!stats` / `!report 22:00` / `!report off` | Aaj ke aankde / daily report |
| `!bc 9198..,9199.. \| text` / `!bc all \| text` | Broadcast (ban risk, kam logon ko) |
| `!read on/off` / `!typing on/off` | Blue tick / insaani typing gap |

Sabke liye (jab `PUBLIC_CMDS=true`): `!tts <text>`, `!tr hindi \| text`, `!weather <shehar>`, `!calc 25*4`, `!joke`, `!sticker` (photo caption me ya photo ko reply karke), `!ocr` (photo se text).

Scheduled voice: `SCHEDULE_3 = 06:00 | voice: Good morning!` ya AI wala `06:00 | voice: ai: ek motivational good morning`.

Limits: voice note, PDF aur video 10 MB tak. Voice reply lamba ho to pehla hissa bola jata hai (~900 akshar).

## Group me schedule bhejna
1. Bot ka number us group ka member hona chahiye.
2. Chat me `!gid` likho. Bot groups ki list aur har ki ID (`1203...@g.us`) bhejega.
3. ID copy karke schedule me numbers wali jagah daalo:
```
!add 09:00 | Good morning sabko ☀️ | 120363012345678901@g.us | all
```
4. `!test N` se ek baar check kar lo.

Group me bot ka AI reply tabhi aayega jab `!groups on` (ya `REPLY_IN_GROUPS=true`) ho. Schedule bhejne ke liye ye zaroori nahi.

## Bot ka behaviour (jo apne aap hota hai)
- **Purane messages ignore**: bot offline tha aur 2 minute se purane messages aaye to unka reply nahi dega.
- **Duplicate messages ignore**: ek hi message do baar aaye to ek hi reply.
- **Reply limit**: ek chat ko 1 minute me `MAX_REPLIES_PER_MIN` se zyada AI reply nahi.
- **Insaani gap**: reply se pehle 1-3 second ka random gap, aur "typing..." dikhta hai.
- **Kya samajhta hai**: text, photo, voice note, PDF, video aur location. Sticker jaise baaki message ignore hote hain.
- **Ek chat ke messages line se**: ek chat ke messages ek-ek karke process hote hain.
- **Auto reconnect**: WhatsApp disconnect ho to bot khud dobara judta hai. Baar-baar fail ho to gap badhata jata hai (3s, 6s, 12s ... max 60s) taaki ban risk na bane.
- **Gemini fail**: pehle 1 baar dobara try, phir fallback models. Sab fail hon to chat me "Abhi jawab nahi de pa raha, thodi der baad try karo." jata hai.
- **Logout hone par**: session apne aap saaf ho jata hai, panel me naya pairing code aata hai.

## Control panel
Domain kholne par (connected hone ke baad):
- Auto reply ON/OFF
- Scheduler ON/OFF
- Saare schedules ki list (time, din, message, target)
- Har schedule ke saamne **Abhi bhejo** (test)
- Logout / naya link

- **🎙 Voice, Calls & Plus panel** ka button (`/plus` page)

`/health` page Railway healthcheck ke liye hai (bina password ke "ok" dikhata hai).

## Code update kaise karein
1. GitHub repo me `index.js` aur `plus.js` (ya jo file badli ho) kholo → pencil/Upload se nayi file dalo → **Commit changes**.
2. Railway apne aap redeploy karega.
3. Volume laga hai to WhatsApp link, chat wale schedules aur settings bache rehte hain.

## Problems

**"Waiting for this message" dikhe:** bot ko Baileys 7 (`package.json` me `7.0.0-rc14`) par rakho aur code me `getMessage` laga hai. Phir bhi aaye to web panel se **Logout / naya link karo**, phone ke Linked Devices se purana device hata ke dobara link karo. Pehle se atke hue messages theek nahi hote, naye theek jayenge.
| Problem | Fix |
|---|---|
| Pairing code nahi aa raha | `PHONE_NUMBER` sahi (country code, bina + ya space) hai? Logs dekho |
| Panel "503" / "ADMIN_PASSWORD variable set karo" | Railway Variables me `ADMIN_PASSWORD` daalo |
| Har deploy par dobara link karna pad raha | Volume `/data` par lagao |
| Reply nahi aa raha | `GEMINI_API_KEY`, `AUTO_REPLY` (ya `!reply on`), `ALLOWED_NUMBERS`, `BLOCKED_NUMBERS` check karo |
| Chat me "Abhi jawab nahi de pa raha" | Gemini API key / quota / model check karo, logs me `Gemini error` dekho. `GEMINI_FALLBACK_MODELS` badal kar dekho |
| Kuch der baad reply band ho gaye | Reply limit lagi ho sakti hai, `MAX_REPLIES_PER_MIN` badhao ya 1 minute ruko |
| Schedule nahi gaya | `TIMEZONE`, format aur panel me Scheduler ON check karo, `!schedules` me ⏸ to nahi, logs dekho |
| `🤖 ⚠️` alert aaya | Schedule 3 baar fail hua. `!status` se connection dekho, `!test N` chalao |
| Group ID / group me message nahi ja raha | Bot ka number group me member hai? `!gid` se sahi ID lo |
| Commands kaam nahi kar rahe | "Message yourself" chat me likho, ya `OWNER_NUMBERS` me apna number daalo (country code ke saath) |
| `!restart` ke baad bot wapas nahi aaya | Railway logs dekho. Max 10 auto restart ki limit ho sakti hai, Railway se manual redeploy karo |
| Logs me `connectionReplaced` | Same WhatsApp session kisi aur jagah bhi chal raha hai (dusra deploy / local). Ek hi jagah chalao |
| Session logout ho gaya | Panel me naya pairing code lo |
| Voice note nahi ja raha, text aa raha hai | Logs me `voice fail` dekho. `GEMINI_API_KEY` / TTS quota check karo, aur Build logs me ffmpeg install hua ya nahi |
| Logs me `ffmpeg nahi mila` | `Dockerfile` naya wala upload karo (usme ffmpeg hai) aur redeploy karo |
| Call par approve prompt nahi aaya | `!callmode` dekho (`off` to nahi?), bot connected ho, aur call kisi group ki na ho |
| Approve ke baad bhi call kat gayi | Normal hai: bot call reject karke voice note bhejta hai, live call me baat nahi kar sakta |
| `!imagine` error | Image model ka quota / naam check karo (`GEMINI_IMAGE_MODEL`), free tier me ye na chale to ye normal hai |

## Dhyan rakhein
Ye unofficial WhatsApp Web library (Baileys) use karta hai. Bahut zyada ya unknown logon ko bulk messages bhejne se number ban ho sakta hai. Zyada testing ke liye alag number use karo aur sirf jaan-pehchan walon ko schedule bhejo. Bot ke apne reply limit aur send delay isi liye hain, unhe kam mat karo.
