# WhatsApp Gemini Bot (Railway)

WhatsApp par Gemini AI se auto reply karne wala bot, saath me **scheduled messages** (roz subah 6:00 good morning, raat 10:00 good night, etc.), **call handling** (approve / cancel, call kaatna, AI se maafi / shukriya message) aur mobile-friendly control panel. Sab kuch Railway **Variables** se ya seedha **WhatsApp chat** se control hota hai.

## Features
- Gemini AI auto reply (Hindi / English / Hinglish), chat ki history yaad rakhta hai
- **Fallback models**: main Gemini model busy / retire / fail ho to bot khud dusra model try karta hai (404 wala model 1 ghante skip hota hai)
- Web page par pairing code, mobile friendly
- Scheduled messages (variables se ya WhatsApp chat se), AI-generated messages bhi
- **AI messages repeat nahi hote**: `ai:` wale schedule me bot pichle messages yaad rakhkar har baar naya likhta hai
- **Auto retry + alert**: schedule na jaye to bot 3 baar dobara try karta hai (sirf unko jinko nahi gaya tha), phir bhi fail ho to aapko WhatsApp par alert bhejta hai
- Panel se Auto reply / Scheduler ON-OFF aur "Abhi bhejo" test button
- Allowed / blocked numbers list
- **WhatsApp chat se poora bot control** (Railway ya web panel me jaye bina)
- **Schedule preview** (`!preview`), **Group ID nikaalna** (`!gid`)
- **Spam / ban se bachav**: har chat par reply limit, sab chats ki mila kar ghante ki limit, insaani jaisa gap, purane aur duplicate messages ignore, group me sirf tag / reply par jawab
- **Call handling (naya)**: call aane par approve / cancel poochta hai (aapke personal number par notification ke saath), na uthane par call **kaat** deta hai aur **AI se bana** maafi message bhejta hai, uthane par AI se shukriya. Detail neeche **Call kaise kaam karti hai**.
- **Photo samajhna**: koi photo bheje to Gemini use dekh kar reply karta hai
- Session Railway Volume me save, redeploy par dobara link nahi karna padta
- **🎙 Plus**: bot bol bhi sakta hai (Gemini TTS voice note, lamba jawab kai voice note me), voice note sunkar samajhta hai, PDF / video padhta hai, sticker, reminder, mausam aur bahut kuch. Poori list **Plus features** me.
- **Khud ko sambhalta hai**: disconnect par badhte gap se reconnect (3s, 6s, 12s ... 60s), bahut der disconnect rahe to khud restart, data atomic save hota hai (beech me band hone par file kharab nahi hoti)

## Repo me kaun si file kya karti hai
| File | Kaam |
|---|---|
| `index.js` | Bot ka core (WhatsApp connection, Gemini, scheduler, commands, web panel) |
| `plus.js` | Voice (TTS), **call handling**, media, tools, `/plus` panel. `index.js` ise khud load karta hai, dono file saath chahiye |
| `package.json` | Dependencies (Baileys, Express, Pino, **exact versions pinned**), Node 20+ |
| `Dockerfile` | Railway build (Node 22, git, ffmpeg). `package-lock.json` repo me ho to `npm ci` chalta hai |
| `railway.json` | Railway deploy settings: Dockerfile build, `/health` healthcheck, restart policy **ALWAYS** (koi 10 baar wali limit nahi) |
| `.gitignore`, `.dockerignore` | `auth/`, `node_modules`, data files repo / image me jaane se rokte hain. **Zaroor upload karo** |
| `README.md` | Ye guide |

## Mobile se setup (sirf phone se)

### 1. GitHub repo banao
1. Phone browser me github.com kholo, login karo, **Desktop site** on karo.
2. **New repository** banao (**Private** rakho).
3. **Add file → Upload files** se ye saari files upload karo: `index.js`, `plus.js`, `package.json`, `Dockerfile`, `railway.json`, `.gitignore`, `.dockerignore`, `README.md`.
4. **Commit changes** dabao.

### 2. Railway par deploy
1. railway.app kholo, GitHub se login karo.
2. **New Project → Deploy from GitHub repo** → apna repo chuno.
3. Deploy hone do (Dockerfile automatically use hoga).

### 3. Volume lagao (bahut zaroori)
Service → **Settings → Volumes (ya Add Volume)** → mount path: `/data`
Iske bina har redeploy par WhatsApp dobara link karna padega, aur chat se kiye gaye schedules/settings bhi ud jayenge. Volume na ho to logs me `VOLUME NAHI LAGA` aata hai, `!status` me dikhta hai, aur connect hone par bot aapko alert bhi bhejta hai.

### 4. Variables daalo
Service → **Variables** me ye daalo:

| Variable | Kaam | Example |
|---|---|---|
| `PHONE_NUMBER` | Bot wala WhatsApp number (country code ke saath, bina +) | `919876543210` |
| `ADMIN_PASSWORD` | Panel ka password. **Lamba aur mushkil rakho** (12+ akshar) | `kuchBhiLamba-Aur-Alag-7391` |
| `GEMINI_API_KEY` | Google AI Studio se API key | `AIza...` |
| `OWNER_NUMBERS` | **Aapka personal number.** Call approval / alert is par notification ke saath aata hai (neeche dekho) | `919812345678` |
| `ALLOWED_NUMBERS` | **Sirf inhi ko reply** (privacy ke liye). Khali = bot **sabko** reply karega | `919812345678,919800000000` |

`ADMIN_PASSWORD` set nahi hoga to panel "503" dikhayega.

> ⚠️ **ALLOWED_NUMBERS khali rakha to** jo bhi aapke bot number par message / photo / voice note bheje, wo sab Gemini ko jata hai. Sirf jaan-pehchan wale logon ke liye bot chala rahe ho to ye zaroor set karo. Logs me aur `!status` me bhi isi ki warning dikhti hai.

### 5. Domain aur pairing
1. Service → **Settings → Networking → Generate Domain**.
2. Domain kholo, password poocha jaye to koi bhi username + `ADMIN_PASSWORD` daalo.
3. Pairing code dikhega. WhatsApp → **Linked Devices → Link with phone number instead** → code daalo.
4. "✅ WhatsApp connected" dikhe to ho gaya.

Code kuch der me expire ho jata hai, bot khud naya code bana leta hai aur page apne aap refresh hota hai.

## Variables (advance)

| Variable | Default | Kaam |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash` | Gemini model. Google purane models retire karta rehta hai, galat / retire naam par bot khud fallback pe chala jata hai. Chat se `!model <naam>` bhi badal sakte ho |
| `GEMINI_FALLBACK_MODELS` | `gemini-3-flash-preview,gemini-2.5-flash,gemini-2.5-flash-lite` | Main model busy / limit / 404 par ye ek-ek karke try hote hain (comma se alag) |
| `GEMINI_TIMEOUT_SEC` | `45` | Gemini request itni der me na aaye to cancel (bot atakta nahi) |
| `SYSTEM_PROMPT` | friendly assistant | Bot ka style / personality |
| `TIMEZONE` | `Asia/Kolkata` | Schedule ka timezone |
| `AUTO_REPLY` | `true` | `false` = sirf schedule chalega, reply nahi |
| `REPLY_IN_GROUPS` | `false` | `true` = groups me reply (neeche `GROUP_TRIGGER` dekho) |
| `GROUP_TRIGGER` | `mention` | `mention` = group me **tabhi** reply jab bot ko tag kiya ho ya bot ke message ka reply kiya ho. `all` = har message par (spam + quota kharch, na use karo) |
| `ALLOWED_NUMBERS` | khali | Sirf inhi numbers ko reply (comma se alag). Khali = sabko |
| `BLOCKED_NUMBERS` | khali | Inko kabhi reply nahi |
| `HISTORY_LIMIT` | `12` | Kitne purane messages yaad rakhe (kam se kam 2) |
| `HISTORY_SAVE` | `true` | `false` = chat history sirf RAM me, disk par nahi (privacy) |
| `HISTORY_KEEP_HOURS` | `48` | Itne ghante se purani chat ki history hata di jati hai |
| `MAX_REPLIES_PER_MIN` | `6` | Ek chat ko 1 minute me max itne AI reply |
| `GLOBAL_AI_PER_HOUR` | `300` | **Sab chats mila kar** 1 ghante me max itne AI reply (Gemini quota / paisa bachane ke liye). Aap (owner) is limit se bahar ho |
| `SCHEDULER` | `on` | `off` = saare schedules band |
| `SCHEDULE_TARGETS` | `PHONE_NUMBER` | Schedule kin numbers ko jaye (comma se alag) |
| `SCHEDULE_CATCHUP_MIN` | `30` | Bot down tha to itne minute tak late bhej dega (usse zyada late ho to skip) |
| `SEND_DELAY_MS` | `3000` | Do numbers ke beech gap (ban risk kam, kam se kam 1000) |
| `OWNER_NUMBERS` | khali | Jin numbers se WhatsApp par bot control ho sake aur jinko alert / call prompt jaye (comma se alag). `OWNER_NUMBER` naam bhi chalega |
| `ALERT_TO_OWNERS` | `true` | Alert aur call prompt `OWNER_NUMBERS` ko bhi jaye (self-chat ke saath). Notification ke liye ye zaroori hai |
| `WATCHDOG_MIN` | `10` | Link ho chuka bot itne minute disconnect rahe to khud restart |
| `DATA_DIR` | `/data` (Volume ho to), warna `.` | Settings aur session yahan save hote hain. Aam taur par mat chhedo |
| `AUTH_DIR` | `DATA_DIR/auth` | WhatsApp session folder. Aam taur par mat chhedo |

Call wale variables **Plus variables** table me hain.

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
- `numbers`: comma se alag. Khali chhodo to default target (`SCHEDULE_TARGETS`, wo bhi na ho to bot ka apna number). `self` likhne par hamesha bot ka apna number. Group ke liye poori group ID (`...@g.us`), ID `!gid` se milti hai.
- `days`: `all`, `weekdays`, `weekend`, ya `mon,tue,wed,thu,fri,sat,sun`.
- Agar galti se numbers wali jagah days likh diye (jaise `| weekdays` ya `| all | mon,tue`) to bot use days hi samajh leta hai.
- Message ke andar `|` mat use karo (wo alag field maana jata hai).
- Message `ai:` se shuru ho to Gemini har baar naya message likhega, pichle ~15-20 messages yaad rakhkar repeat nahi karega.
- Placeholders: `{date}`, `{day}`, `{time}`.
- Galat format wala schedule skip ho jata hai, logs me likha aata hai.
- Variable badalne ke baad Railway apne aap redeploy karta hai.

**Retry aur alert**
- Schedule na jaye (WhatsApp disconnect, Gemini fail, bhejna fail) to bot 1 minute baad dobara try karta hai, kul 3 baar. Retry me **sirf wahi numbers** jate hain jinko pehle nahi gaya tha (kisi ko double message nahi).
- 3 baar fail hone par `🤖 ⚠️` alert aata hai, jisme wajah aur fail hue numbers likhe hote hain. WhatsApp disconnect ho to alert rukta hai aur **connect hote hi** aa jata hai.
- Bot band / down tha to `SCHEDULE_CATCHUP_MIN` minute tak ka missed schedule late bhej deta hai. Usse zyada late ho to skip.
- Ek din me ek schedule ek hi baar jata hai (redeploy par dobara nahi, agar Volume laga hai).

## WhatsApp se control (Railway me jaye bina)

Commands `!` ya `/` se shuru hote hain. Bot har jawab `🤖` se shuru karta hai.

**Control chat kaise kholein (2 tareeke)**
1. **"Message yourself" chat**: bot jis number par linked hai usi ke apne chat me `!help` likho.
2. **Alag number se (recommended)**: Railway Variables me `OWNER_NUMBERS=919876543210` (aapka personal number) daalo. Phir bot ka number phone me kisi bhi naam se save karo, aur us chat me `!help` likho. **Isi chat me aapko call approval aur alerts notification ke saath aate hain.**

Sirf `OWNER_NUMBERS` wale numbers aur bot ka apna chat hi commands chala sakte hain (owner commands sirf personal chat me, group me nahi). Baaki log `!` likhen to bot use normal message samajhkar AI reply deta hai.

`!` wala command galat likha to "command nahi mila" aata hai. `/` se shuru koi unknown text (jaise `/start`) command nahi maana jata, chup chap ignore hota hai.

**Commands**

| Command | Kaam |
|---|---|
| `!help` | Menu (`!menu`, `!h` bhi) |
| `!status` | Bot ka haal: connection, time, auto reply, schedules, model, owners, Volume, uptime |
| `!reply on/off` | AI auto reply |
| `!calls on/off` | Call ke baad AI message bhejna (approve / cancel system `!callmode` se alag hai) |
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
| `!test N` | Abhi bhejo (natija alert me aata hai) |
| `!preview N` | AI message kaisa banega dekho, kisi ko bheje bina |
| `!scheduler on/off` | Saare schedules on/off |
| `!targets 9198..,9199..` / `!targets reset` | Schedule kin numbers ko jaye |
| `!tz Asia/Kolkata` / `!tz reset` | Timezone |
| `!gid` | Bot ke saare groups ki naam + ID list (`!groupids` bhi) |
| `!send <number ya group-ID> <message>` | Kisi ko ya group ko abhi message bhejo |
| `!restart` | Data save karke bot restart |

`on/off` ki jagah `chalu / band / haan / nahi` bhi likh sakte ho.

Example:
```
!add 06:00 | Good morning ☀️
!add 22:00 | Good night 🌙
!add 08:00 | ai: motivational message likho, aaj {day} hai | self | weekdays
!add 09:00 | Good morning sabko ☀️ | 120363012345678901@g.us | all
!preview 3
!off 2
```

Chat se kiye gaye badlav `/data` Volume me save hote hain aur Railway Variables se **upar** chalte hain. `reset` likhne par wapas Variables wali value chalu ho jaati hai. Railway ke `SCHEDULE_n` wale schedules `!del` se nahi hatte, unhe `!off N` se band karo.

`!restart` ke baad bot 20-30 second me wapas aata hai. Restart policy **ALWAYS** hai, to koi "10 baar" wali limit nahi.

## Call kaise kaam karti hai (zaroori, dhyan se padho)

### Pehle ek sachchai
WhatsApp ki **live call me bot bol ya sun nahi sakta.** Baileys call ka audio support nahi karta aur call "utha" bhi nahi sakta. Isliye bot **call ko live nahi uthata.** Wo kya karta hai:
- call **kaat** deta hai,
- caller ko **voice note** bhejta hai aur **voice chat** shuru karta hai (caller voice note / text bheje, bot voice me jawab de).

Asli live call me baat karne ke liye Meta ka WhatsApp Business Calling API ya SIP / WebRTC bridge chahiye. Wo bilkul alag setup hai aur ye bot wo nahi karta.

### Ek call = ek faisla = caller ko max ek message
Bot har call par ye faisla is order me leta hai:

| # | Haalat | Bot kya karta hai |
|---|---|---|
| 1 | `!callmode off` | Kuch nahi poochta. Call khatam hone par: uthi to AI **shukriya**, nahi uthi to AI **maafi** message |
| 2 | Number blocked / `ALLOWED_NUMBERS` me nahi | Kuch nahi |
| 3 | `!callmode auto`, ya number `!callvip` me, ya **DND time** (`!dnd`), ya **dobara call** (neeche) | Bina poochhe khud sambhalta hai: call kaatna + voice note + voice chat, phir aapko alert |
| 4 | Baaki sab (default `!callmode ask`) | Aapko **approve / cancel** prompt bhejta hai |

### Approve / Cancel (ask mode)
Prompt aapko "Message yourself" chat me **aur** `OWNER_NUMBERS` wale personal chat me jata hai. (Apne hi chat me bheje message par aksar notification nahi aata, isliye `OWNER_NUMBERS` set karna best hai.) Jawab me sirf poora **`1`** ya **`2`** (ya ✅ / ❌) likho:

| Aap kya karo | Bot kya karta hai |
|---|---|
| **`1` = Approve** | Call **kaat** deta hai, caller ko voice note bhejta hai, voice chat shuru |
| **`2` = Cancel** | Bot kuch nahi karta. Call ringing chhod deta hai (aap khud utha sakte ho), caller ko koi message nahi. Call bhi kaatni ho to `CALL_CANCEL_REJECT=true` |
| **Aap khud call utha lo** (`CALL_APPROVAL_SEC` ke andar) | Bot hat jata hai, call kaat-ta nahi. Call ke baad caller ko AI **shukriya** message |
| **Kuch nahi bola** (`CALL_APPROVAL_SEC`, default 45s) | Call **kaat** deta hai aur caller ko AI **maafi** message (baat / samasya puchta hai), aapko alert. (`CALL_APPROVAL_DEFAULT=auto` ho to timeout par khud voice me baat karta hai) |

Aur zaroori baatein:
- **Sirf `1` / `2`** approval maana jata hai. "ok", "haan", "nahi" jaise normal message ab galti se approve / cancel nahi karte.
- Ek saath **do calls pending** hon to `1` / `2` par bot poochta hai kaunsi; tab `!approve C2` / `!cancel C1` likho.
- Prompt panel `/plus` me bhi buttons ke saath dikhta hai.
- Agar prompt aap tak pahunch hi nahi paya (WhatsApp connected nahi), bot 45 second intezaar nahi karta, turant default action leta hai.
- Call kaatna **fail** ho (logs me `rejectCall fail`), to bot alert bhejta hai: "call kat nahi paayi". Bot 3 alag ID (`from`, `chatId`, phone) se koshish karta hai kyunki Baileys 7 me LID aur phone number alag ho sakte hain.

### Call ke baad ka message AI se (boring "shukriya" nahi)
- Message Gemini se bantaa hai: caller ka naam (agar WhatsApp naam pata ho), din ka samay (subah / shaam...), kitni baar call ki, voice / video, aur pichle messages se alag shabd. Har baar naya.
- **Maafi wale message me ye bhi hota hai:** "baat urgent ho to dobara call kar sakte hain" (taaki repeat-call logic kaam kare).
- Gemini fail ho to `CALL_MISSED_MSG` / `CALL_ANSWERED_MSG` wala fixed text jata hai (error text kabhi nahi jata).
- `CALL_AI_MSG=false` karo to hamesha fixed text. `!calls off` / `CALL_REPLY=false` = call ke baad koi message nahi.
- Ek hi number ko `CALL_COOLDOWN_SEC` (120s) tak dobara call-message nahi (baar-baar call par spam nahi).
- Group call aur offline (purani) call par kuch nahi hota, logs me `call skip` likha aata hai.

### Dobara call (repeat) kaise pakdi jati hai
Number se call aayi aur aapne **nahi uthayi**, aur `REPEAT_CALL_MIN` (10 min) ke andar **usi number se phir** call aayi, to bot bina poochhe khud sambhalta hai. Number hamesha phone number me badla jata hai (LID ho tab bhi), isliye purani call match hoti hai.

### Call debug kaise karein
Railway logs me ye lines dekho:
- `call event: offer / accept / terminate ...` (call kaise pakdi gayi)
- `rejectCall bheja` ya `rejectCall fail:` (call kaatna)
- `call msg (missed, AI) -> ...` (kaunsa message gaya)
- `!calllog` se bhi pichli calls aur unka natija dekh sakte ho.

## Photo
Koi photo (caption ke saath ya bina) bheje to bot use dekh kar reply karta hai. 8 MB se badi photo ya jo download na ho, uske liye bot dobara bhejne ko kehta hai.

## 🎙 Plus features (voice, calls, tools)

Ye sab `plus.js` me hain. Menu dekhne ke liye bot ke chat me `!plus` likho. Panel: `https://<aapka-domain>/plus`.

### Plus variables (sab optional)
| Variable | Default | Kaam |
|---|---|---|
| `TTS_VOICE` | `Kore` | Bot ki awaaz (30 options, `!voice` se list) |
| `REPLY_MODE` | `text` | `text` / `voice` / `both` |
| `CALL_APPROVAL_SEC` | `45` | Approve / cancel ka jawab dene ka time (kam se kam 5) |
| `CALL_APPROVAL_DEFAULT` | `ignore` | Time khatam hone par: `ignore` = call kato + AI maafi message, `auto` = khud voice me baat kare |
| `CALL_REJECT_ON_TIMEOUT` | `true` | `false` = timeout par call mat kato (sirf message bhejo) |
| `CALL_REJECT_ON_APPROVE` | `true` | `false` = approve par call ringing chhod do, sirf voice note bhejo |
| `CALL_CANCEL_REJECT` | `false` | `true` = Cancel (2) dabane par call bhi kat do |
| `CALL_AI_MSG` | `true` | Call ke baad ka message AI se bane. `false` = fixed text |
| `CALL_ANSWERED_MSG` | shukriya wala | AI fail ho ya `CALL_AI_MSG=false` ho tab ye jata hai |
| `CALL_MISSED_MSG` | maafi + samasya puchne wala | AI fail ho ya `CALL_AI_MSG=false` ho tab ye jata hai |
| `CALL_COOLDOWN_SEC` | `120` | Ek number ko itni der tak dobara call-message nahi |
| `REPEAT_CALL_MIN` | `10` | Itne minute me dobara call aaye to auto-handle |
| `VOICE_SESSION_MIN` | `10` | Voice chat itni der shant rahe to khatam + aapko summary |
| `CALL_GREETING` | default greeting | Approve ke baad caller ko jo voice note jaye |
| `PUBLIC_CMDS` | `true` | `false` = `!tts`, `!weather` jaise commands sirf aap chala sako. **Sabke liye khule hain to quota kharch hota hai** |
| `FLOOD_LIMIT` | `25` | 1 minute me itne se zyada message bheje to 1 ghante ignore |
| `BROADCAST_MAX` | `30` | `!bc` se ek baar me max itne log |
| `MAX_VOICE_PARTS` | `3` | Lamba jawab itne voice note tak (~800 akshar har ek). Bacha hissa text me jata hai |
| `VOICE_INBOX` | `false` | `true` = panel me voice notes sunna (privacy ke liye default band, RAM me bhi nahi rakhta) |
| `GEMINI_TTS_MODEL` | `gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts` | Awaaz wale model (comma se alag). Pehla fail / retire ho to agla chalta hai |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image-preview,gemini-2.5-flash-image` | `!imagine` ke model (comma se alag, fallback ke saath) |

### Kya-kya hai
- **Voice**: voice note reply (Gemini TTS), voice note sunkar jawab, 30 awaazein, tone, text/voice/both mode, voice ka jawab voice me (mirror), `!say`, `!sayto`, scheduled voice, TTS fail ho to text, lamba jawab kai voice note me
- **Calls**: approve/cancel, call kaatna, AI maafi / shukriya, repeat call auto-handle, VIP list, DND time, call log, custom greeting, voice chat khatam hone par summary, panel buttons
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
| `!callmode ask\|auto\|off` | ask = approve poochega (default), auto = khud sambhalega, off = kuch nahi poochega (sirf call ke baad AI message) |
| `!approve [id]` / `!cancel [id]` | Call approve / cancel (ya seedha `1` / `2` likho). Ek se zyada pending ho to id zaroori |
| `!callvip add/del/list <number>` | In numbers ki call hamesha auto-handle |
| `!callgreet <text>` / `reset` | Approve ke baad jo voice note jaye |
| `!calllog` | Pichli calls aur natija |
| `!sessions` / `!endvoice [number\|all]` | Chalti voice chats dekho / band karo |
| `!dnd 23:00-07:00` / `!dnd off` | Is time approval nahi poochega, bot khud call sambhalega |
| `!persona [naam]` | friendly, teacher, funny, formal, shayar, support, coach |
| `!lang hindi\|english\|hinglish\|auto` | Jawab ki bhasha |
| `!kb add/del/list/clear` | Bot ko jaankari / FAQ do |
| `!busy <wajah>` / `!busy off` | Bot logon ko batayega ki aap busy ho |
| `!welcome <text>` / `off` | Naye logon ko pehla message |
| `!summary [number]` | Chat ka summary |
| `!imagine <prompt>` | Image banao |
| `!remind 30m \| text` / `!remind 18:30 \| text` / `list` / `del N` | Yaad dilao (bot band tha to late bhejta hai, "der se" likh kar) |
| `!note <text>` / `!note list/del N/clear` | Notes |
| `!poll Sawal \| a \| b \| c` | Poll |
| `!stats` / `!report 22:00` / `!report off` | Aaj ke aankde (calls, approve, timeout, reject fail ...) / daily report |
| `!bc 9198..,9199.. \| text` / `!bc all \| text` | Broadcast. **Ban risk.** `all` sirf unko jinka asli phone number pata ho (LID wale skip) |
| `!read on/off` / `!typing on/off` | Blue tick / insaani typing gap |

Sabke liye (jab `PUBLIC_CMDS=true`): `!tts <text>`, `!tr hindi \| text`, `!weather <shehar>`, `!calc 25*4`, `!joke`, `!sticker` (photo caption me ya photo ko reply karke), `!ocr` (photo se text).

Scheduled voice: `SCHEDULE_3 = 06:00 | voice: Good morning!` ya AI wala `06:00 | voice: ai: ek motivational good morning`.

Limits: voice note, PDF aur video 10 MB tak. Voice reply lamba ho to 3 voice note tak, baaki text me.

## Group me schedule bhejna
1. Bot ka number us group ka member hona chahiye.
2. Chat me `!gid` likho. Bot groups ki list aur har ki ID (`1203...@g.us`) bhejega.
3. ID copy karke schedule me numbers wali jagah daalo:
```
!add 09:00 | Good morning sabko ☀️ | 120363012345678901@g.us | all
```
4. `!test N` se ek baar check kar lo.

Group me bot ka AI reply tabhi aayega jab `!groups on` (ya `REPLY_IN_GROUPS=true`) ho **aur** kisi ne bot ko tag kiya ho ya bot ke message ka reply kiya ho (`GROUP_TRIGGER=mention`). Schedule bhejne ke liye ye sab zaroori nahi.

## Bot ka behaviour (jo apne aap hota hai)
- **Purane messages ignore**: bot offline tha aur 2 minute se purane messages aaye to unka reply nahi dega.
- **Duplicate messages ignore**: ek hi message ID do baar aaye to ek hi reply.
- **Reply limit**: ek chat ko 1 minute me `MAX_REPLIES_PER_MIN` se zyada nahi, aur sab chats mila kar ghante me `GLOBAL_AI_PER_HOUR` se zyada nahi.
- **Insaani gap**: reply se pehle 1-3 second ka random gap, aur "typing..." dikhta hai.
- **Kya samajhta hai**: text, photo, voice note, PDF, video aur location. Sticker jaise baaki message ignore hote hain.
- **Ek chat ke messages line se**: ek chat ke messages ek-ek karke process hote hain. Koi kaam 150 second se zyada atke to queue aage badh jati hai.
- **Auto reconnect**: WhatsApp disconnect ho to bot khud dobara judta hai, gap badhta jata hai (3s, 6s, 12s ... max 60s). Connect hone ki koshish khud fail ho jaye to bhi dobara try hota hai. Link ho chuka bot `WATCHDOG_MIN` (10 min) se zyada disconnect rahe to khud restart hota hai.
- **/health**: WhatsApp 5 minute se zyada disconnect ho to 503 deta hai.
- **Gemini fail**: pehle 1 baar dobara try, phir fallback models. Sab fail hon to chat me "Abhi jawab nahi de pa raha, thodi der baad try karo." jata hai. Ye error text kabhi history, summary, joke / translate / OCR ke asli jawab ya alert me nahi jata.
- **Logout hone par**: session apne aap saaf ho jata hai, panel me naya pairing code aata hai.
- **Band hone par save**: redeploy / restart (SIGTERM) par settings, history, stats, calls sab pehle save hote hain. Files atomic likhi jati hain aur `.bak` backup bhi rehta hai.
- **Kharab state**: koi anjaan crash (`uncaughtException`) ho to bot data save karke band hota hai aur Railway use dobara chalu karta hai.

## Control panel
Domain kholne par (connected hone ke baad):
- Auto reply ON/OFF
- Scheduler ON/OFF
- Saare schedules ki list (time, din, message, target)
- Har schedule ke saamne **Abhi bhejo** (test)
- Logout / naya link
- **🎙 Voice, Calls & Plus panel** ka button (`/plus` page): call approval buttons, chalti voice chats, call log, awaaz test

`/health` page Railway healthcheck ke liye hai (password nahi chahiye, sirf "ok connected" jaisa status dikhata hai).

**Panel ki suraksha**: 8 galat password ke baad 15 minute block. Har button (POST) par CSRF token aur same-site check hota hai, to koi doosri website aapke login se panel ka button nahi dabwa sakti. Password lamba rakho, kisi se share mat karo. Voice inbox default band hai.

## Code update kaise karein
1. GitHub repo me `index.js` aur `plus.js` (ya jo file badli ho) kholo → pencil/Upload se nayi file dalo → **Commit changes**.
2. Railway apne aap redeploy karega.
3. Volume laga hai to WhatsApp link, chat wale schedules aur settings bache rehte hain.

**Versions lock karna (optional par achha)**: `package.json` me versions pinned hain, to build me kuch badalta nahi. Chahe to apne computer par `npm install` chalakar bana `package-lock.json` bhi repo me daal do, tab Docker `npm ci` use karega.

## Problems

**"Waiting for this message" dikhe:** bot ko Baileys 7 par rakho aur `getMessage` laga hai. Phir bhi aaye to web panel se **Logout / naya link karo**, phone ke Linked Devices se purana device hata ke dobara link karo. Pehle se atke hue messages theek nahi hote, naye theek jayenge.

| Problem | Fix |
|---|---|
| Pairing code nahi aa raha | `PHONE_NUMBER` sahi (country code, bina + ya space) hai? Logs dekho |
| Panel "503" / "ADMIN_PASSWORD variable set karo" | Railway Variables me `ADMIN_PASSWORD` daalo |
| Panel "429 Bahut galat koshish" | 8 galat password ho gaye. 15 minute ruko, sahi password se dobara |
| Panel button dabane par "CSRF token galat" | Page refresh karo aur dobara dabao (purana page khula tha) |
| Har deploy par dobara link karna pad raha | Volume `/data` par lagao |
| Reply nahi aa raha | `GEMINI_API_KEY`, `AUTO_REPLY` (ya `!reply on`), `ALLOWED_NUMBERS`, `BLOCKED_NUMBERS` check karo. Group me ho to bot ko tag karo |
| Chat me "Abhi jawab nahi de pa raha" | Gemini API key / quota / model check karo, logs me `Gemini error` dekho. Logs me `nahi mila (retire ho gaya...)` ho to `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` badlo |
| Kuch der baad reply band ho gaye | Reply limit lagi hogi: `MAX_REPLIES_PER_MIN` ya `GLOBAL_AI_PER_HOUR` (logs me `rate limit` / `global limit`) |
| Schedule nahi gaya | `TIMEZONE`, format aur panel me Scheduler ON check karo, `!schedules` me ⏸ to nahi, logs dekho |
| `🤖 ⚠️` alert aaya | Alert me wajah likhi hoti hai. `!status` se connection dekho, `!test N` chalao |
| Group ID / group me message nahi ja raha | Bot ka number group me member hai? `!gid` se sahi ID lo |
| Commands kaam nahi kar rahe | "Message yourself" chat me likho, ya `OWNER_NUMBERS` me apna number daalo (country code ke saath) |
| `!restart` ke baad bot wapas nahi aaya | Railway logs dekho. `railway.json` me restart policy `ALWAYS` hona chahiye |
| Logs me `connectionReplaced` | Same WhatsApp session kisi aur jagah bhi chal raha hai (dusra deploy / local). Ek hi jagah chalao |
| Session logout ho gaya | Panel me naya pairing code lo |
| Voice note nahi ja raha, text aa raha hai | Logs me `voice fail` / `gemini media error` dekho. `GEMINI_API_KEY` / TTS quota / `GEMINI_TTS_MODEL` check karo, Build logs me ffmpeg dekho |
| Logs me `ffmpeg nahi mila` | `Dockerfile` naya wala upload karo (usme ffmpeg hai) aur redeploy karo |
| Call par approve prompt nahi aaya | `!callmode` dekho (`off` to nahi?), bot connected ho, call group ki na ho. **`OWNER_NUMBERS` set karo**, tab prompt personal chat me notification ke saath aata hai. Logs me `alert queue me rakha` ho to WhatsApp disconnect tha |
| Prompt aaya par `1` likhne par kuch nahi hua | Sirf poora `1` ya `2` chalta hai (aur sirf jab call pending ho, `CALL_APPROVAL_SEC` ke andar). Do calls pending hon to `!approve C1` likho |
| Call kati nahi, ringing chalti rahi | Logs me `rejectCall fail:` / `call event:` dekho. Bot 3 alag ID se try karta hai aur fail par aapko alert bhejta hai. `Cancel (2)` par call jaan-bujhkar nahi kati jati (`CALL_CANCEL_REJECT=true` se kat jayegi) |
| Maine call khud utha li par bot ne kaat di | Bot ko "accept" event WhatsApp se milta hai; kabhi kabhi der se / nahi milta. `CALL_REJECT_ON_TIMEOUT=false` kar do (tab timeout par call nahi katega, sirf message jayega), ya `CALL_APPROVAL_SEC` kam rakho aur jaldi `2` dabao |
| Approve ke baad bhi call kat gayi / live baat nahi hui | Normal hai: bot call kaat kar voice note bhejta hai, live call me baat nahi kar sakta (upar "Pehle ek sachchai") |
| Caller ko call ke baad message nahi gaya | `!calls on` hai? `CALL_COOLDOWN_SEC` ke andar to nahi? Number blocked / `ALLOWED_NUMBERS` me nahi to? `!callmode` dekho. Logs me `call msg` line dekho |
| Call ke baad ka message fixed jaisa aa raha | Gemini fail hua (logs me `call msg AI error` / `Gemini error`), tab `CALL_MISSED_MSG` jata hai |
| `!imagine` error | Image model ka quota / naam check karo (`GEMINI_IMAGE_MODEL`), free tier me ye na chale to normal hai. Thumbnail ab ffmpeg se bante hain, sharp / jimp ki zaroorat nahi |
| Bot ko sabhi reply de raha hai | `ALLOWED_NUMBERS` khali hai. Sirf jinko chahiye unke numbers daalo |

## Is version me kya fix hua (purani galtiyon ki list)

| Pehle ki problem | Ab |
|---|---|
| Call ke baad fixed boring message | AI message (naam, samay, context), fail par fixed text |
| Ask mode me call kabhi nahi katti thi / timeout par ringing chalti thi | Timeout par call katti hai + maafi message. Approve par katti hai. Fail par alert, 3 ID se koshish |
| Approval prompt notification nahi deta tha, chup chap fail hota tha | Prompt `OWNER_NUMBERS` ke personal chat me bhi jata hai. Disconnect ho to alert queue me rukta hai, connect par jata hai |
| "ok / haan / nahi" approval ban jate the, do calls me galat call approve | Sirf `1` / `2`; do pending hon to bot poochta hai |
| Ek call par approval prompt aur missed message alag-alag logic se (do behaviour) | Ek state machine, ek call par max ek message |
| Repeat-call number (phone / LID) match nahi hota tha | Number hamesha phone me badla jata hai |
| Reconnect fix 3s, fail par bot dead, listeners duplicate | Badhta backoff, fail par bhi retry, purane listeners hatte hain, watchdog restart, `/health` sachcha |
| `runSchedule` fail par bhi true, alert nahi | Sach natija, sirf failed numbers par retry, alert (disconnect me queue) |
| Duplicate message ID ignore nahi hota tha | Ab hota hai |
| AI error text asli content ban jata tha (`!joke`, `!tr`, `!ocr`, summary) | Fail par alag saaf message, summary alert me nahi |
| Gemini / weather par timeout nahi | Timeouts + queue timeout, ffmpeg timeout |
| LID / phone number mismatch (owner, blocked, allowed, flood, `!bc all`) | LID se phone number nikalne ki koshish, `!bc all` sirf asli phone wale |
| Settings file crash par kharab, redeploy par aakhri data jaata tha | Atomic write + `.bak`, SIGTERM par save |
| RAM badhti thi (history, contacts, flood, calls, voice inbox) | Sab par cap / safai, voice inbox default band |
| Voice reply 900 akshar par kat jata tha | Kai voice note, baaki text me |
| Group me har message par Gemini reply | Sirf tag / reply par |
| `!add` example galat, `/start` jaisa text command ban jata tha | Fix, aur days galat field me ho to bhi chalte hain |
| `!restart` Railway ke 10 retry me ginta tha | Policy `ALWAYS` |
| `calc()` me `Function()` | Chhota safe parser |
| Node 20 EOL | Node 22 |
| Versions `^` se badal sakte the | Exact pinned (lock file optional) |
| `.gitignore` / `.dockerignore` nahi the | Diye gaye |
| Purane model naam (`gemini-2.0-flash`, TTS / image preview) | Naye defaults + fallback list, 404 model skip |
| `!imagine` ko sharp / jimp chahiye ho sakta tha | ffmpeg se thumbnail |
| Panel: brute-force, CSRF, voice inbox | 8 galat par block, CSRF token, inbox default band |
| Sabko reply, global limit nahi | Warning (logs + `!status`), `GLOBAL_AI_PER_HOUR`, `HISTORY_SAVE` / `HISTORY_KEEP_HOURS` |
| Prompt injection (system prompt / KB nikalwana) | Suraksha niyam har jawab me jode gaye (pura rok nahi sakte, neeche dekho) |

## Jo fix nahi ho sakta (sach)
- **Live call me bot ka bolna / sunna**: Baileys me hai hi nahi (upar samjhaya).
- **Baileys `7.0.0-rc14` release candidate hai**, stable 7 abhi nahi aaya. Version pinned hai taaki achanak na badle, par RC me bugs ho sakte hain.
- **Ban ka risk**: Baileys unofficial hai. Auto reply, auto call kaatna aur broadcast se WhatsApp number ban kar sakta hai. Zyada testing ke liye alag number use karo.
- **Prompt injection**: koi chalak banda bot se uski settings / knowledge base nikalwane ki koshish kar sakta hai. Safety niyam isse mushkil banate hain, par 100% nahi rokte. Knowledge base (`!kb`) me **koi password / private baat mat daalo**.
- **Gemini quota / paisa**: `GLOBAL_AI_PER_HOUR` aur `MAX_REPLIES_PER_MIN` kharch rokte hain, par API key ki apni limit Google ke dashboard me dekhte raho.

## Dhyan rakhein
Ye unofficial WhatsApp Web library (Baileys) use karta hai. Bahut zyada ya unknown logon ko bulk messages bhejne se number ban ho sakta hai. Zyada testing ke liye alag number use karo aur sirf jaan-pehchan walon ko schedule bhejo. Bot ke reply limit aur send delay isi liye hain, unhe kam mat karo.
