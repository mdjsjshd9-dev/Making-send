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

## Repo me kaun si file kya karti hai
| File | Kaam |
|---|---|
| `index.js` | Poora bot (WhatsApp, Gemini, scheduler, commands, web panel) |
| `package.json` | Dependencies (Baileys, Express, Pino), Node 20+ |
| `Dockerfile` | Railway par build karne ke liye (git install hota hai kyunki Baileys ki ek dependency GitHub se aati hai) |
| `railway.json` | Railway deploy settings: Dockerfile build, `/health` healthcheck, fail hone par auto restart (max 10 baar) |
| `.gitignore`, `.dockerignore` | Faltu files upload/build hone se rokte hain |
| `README.md` | Ye guide |

## Mobile se setup (sirf phone se)

### 1. GitHub repo banao
1. Phone browser me github.com kholo, login karo, **Desktop site** on karo.
2. **New repository** banao (Private rakhna better hai).
3. **Add file → Upload files** se ye files upload karo: `index.js`, `package.json`, `Dockerfile`, `railway.json`, `.gitignore`, `.dockerignore`, `README.md`.
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

- **Call**: bot jab chal raha ho aur aapke number par WhatsApp call aaye. Call uthayi to `CALL_ANSWERED_MSG`, na uthayi (ya cut kar di) to `CALL_MISSED_MSG` jata hai aur aapko "Missed call" alert milta hai. Group call par kuch nahi hota. Chat se `!calls on/off`.
- **Photo**: koi photo (caption ke saath ya bina) bheje to bot use dekh kar reply karta hai. 8 MB se badi photo ya jo download na ho, uske liye bot dobara bhejne ko kehta hai.
- Call kaise pakdi gayi ye Railway logs me `call event:` wali lines me dikhta hai.

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
- **Sirf text**: text ya photo/video ke caption ka reply aata hai. Bina text wale message (voice note, sticker, etc.) ignore hote hain.
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

`/health` page Railway healthcheck ke liye hai (bina password ke "ok" dikhata hai).

## Code update kaise karein
1. GitHub repo me `index.js` (ya jo file badli ho) kholo → pencil/Upload se nayi file dalo → **Commit changes**.
2. Railway apne aap redeploy karega.
3. Volume laga hai to WhatsApp link, chat wale schedules aur settings bache rehte hain.

## Problems
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

## Dhyan rakhein
Ye unofficial WhatsApp Web library (Baileys) use karta hai. Bahut zyada ya unknown logon ko bulk messages bhejne se number ban ho sakta hai. Zyada testing ke liye alag number use karo aur sirf jaan-pehchan walon ko schedule bhejo. Bot ke apne reply limit aur send delay isi liye hain, unhe kam mat karo.
