# WhatsApp Gemini Bot (Railway)

WhatsApp par Gemini AI se auto reply karne wala bot, saath me **scheduled messages** (roz subah 6:00 good morning, raat 10:00 good night, etc.) aur mobile-friendly control panel. Sab kuch Railway **Variables** se control hota hai.

## Features
- Gemini AI auto reply (Hindi / English / Hinglish)
- Web page par pairing code, mobile friendly
- Scheduled messages (variables se), AI-generated messages bhi
- Panel se Auto reply / Scheduler ON-OFF aur "Abhi bhejo" test button
- Allowed / blocked numbers list
- **WhatsApp chat se poora bot control** (Railway ya web panel me jaye bina)
- Session Railway Volume me save, redeploy par dobara link nahi karna padta

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
Iske bina har redeploy par WhatsApp dobara link karna padega.

### 4. Variables daalo
Service → **Variables** me ye daalo:

| Variable | Kaam | Example |
|---|---|---|
| `PHONE_NUMBER` | Bot wala WhatsApp number (country code ke saath, bina +) | `919876543210` |
| `ADMIN_PASSWORD` | Panel ka password | `mypass123` |
| `GEMINI_API_KEY` | Google AI Studio se API key | `AIza...` |

### 5. Domain aur pairing
1. Service → **Settings → Networking → Generate Domain**.
2. Domain kholo, password poocha jaye to koi bhi username + `ADMIN_PASSWORD` daalo.
3. Pairing code dikhega. WhatsApp → **Linked Devices → Link with phone number instead** → code daalo.
4. "✅ WhatsApp connected" dikhe to ho gaya.

## Variables (advance)

| Variable | Default | Kaam |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `SYSTEM_PROMPT` | friendly assistant | Bot ka style / personality |
| `TIMEZONE` | `Asia/Kolkata` | Schedule ka timezone |
| `AUTO_REPLY` | `true` | `false` karo to sirf schedule chalega, reply nahi |
| `REPLY_IN_GROUPS` | `false` | `true` = groups me bhi reply |
| `ALLOWED_NUMBERS` | khali | Sirf inhi numbers ko reply (comma se alag) |
| `BLOCKED_NUMBERS` | khali | Inko kabhi reply nahi |
| `HISTORY_LIMIT` | `12` | Kitne purane messages yaad rakhe |
| `SCHEDULER` | `on` | `off` = saare schedules band |
| `SCHEDULE_TARGETS` | `PHONE_NUMBER` | Schedule kin numbers ko jaye (comma se alag) |
| `SCHEDULE_CATCHUP_MIN` | `10` | Bot down tha to itne minute tak late bhej dega |
| `SEND_DELAY_MS` | `3000` | Do numbers ke beech gap (ban risk kam) |
| `OWNER_NUMBERS` | khali | Jin numbers se WhatsApp par bot control ho sake (comma se alag) |

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
SCHEDULE_4 = 08:00 | ai: Ek chhota motivational message likho, aaj {day} hai | all | weekdays
SCHEDULE_5 = 07:00,19:00 | Paani piyo 💧
```

Rules:
- Time 24 ghante format me (`22:00` = raat 10 baje).
- Ek schedule me kai time: `07:00,19:00`.
- `numbers`: comma se alag; khali ya `self` = default target. Group ke liye poori group JID (`...@g.us`) bhi chalegi.
- `days`: `all`, `weekdays`, `weekend`, ya `mon,tue,wed,thu,fri,sat,sun`.
- Message ke andar `|` mat use karo.
- Message `ai:` se shuru ho to Gemini har baar naya message likhega.
- Placeholders: `{date}`, `{day}`, `{time}`.
- Variable badalne ke baad Railway apne aap redeploy karta hai.

## WhatsApp se control (Railway me jaye bina)

Bot ko WhatsApp chat se hi control kar sakte ho. Commands `!` ya `/` se shuru hote hain. Bot har jawab `🤖` se shuru karta hai.

**Control chat kaise kholein (2 tareeke)**
1. **"Message yourself" chat**: bot jis number par linked hai usi ke apne chat me `!help` likho. Kuch set nahi karna.
2. **Alag number se**: Railway Variables me `OWNER_NUMBERS=919876543210` (aapka personal number, comma se kai) daalo. Phir bot ka number phone me **"Unbout"** (ya koi bhi naam) se save karo, aur us chat me `!help` likho. Chat usi naam se dikhega.

Sirf `OWNER_NUMBERS` wale numbers aur bot ka apna chat hi commands chala sakte hain. Baaki log `!` likhen to bot use normal message samajhkar AI reply deta hai.

**Commands**

| Command | Kaam |
|---|---|
| `!help` | Menu |
| `!status` | Bot ka haal |
| `!reply on/off` | AI auto reply |
| `!groups on/off` | Groups me reply |
| `!prompt <text>` / `!prompt reset` | Bot ki personality badlo |
| `!model <naam>` / `!model reset` | Gemini model |
| `!clear` | Chat history saaf |
| `!allow add/del/list/clear/reset <number>` | Sirf inko reply |
| `!block add/del/list/clear/reset <number>` | Inko reply nahi |
| `!schedules` | Saare schedules |
| `!add 06:00 \| Good morning \| numbers \| days` | Naya schedule |
| `!del N` | Chat se banaya schedule hatao |
| `!off N` / `!on N` | Schedule pause / chalu |
| `!test N` | Abhi bhejo |
| `!scheduler on/off` | Saare schedules on/off |
| `!targets 9198..,9199..` | Schedule kin numbers ko jaye |
| `!tz Asia/Kolkata` | Timezone |
| `!send <number> <message>` | Kisi ko abhi message bhejo |
| `!restart` | Bot restart |

Example:
```
!add 06:00 | Good morning ☀️
!add 22:00 | Good night 🌙
!add 08:00 | ai: motivational message likho, aaj {day} hai | all | weekdays
!off 2
```

Chat se kiye gaye badlav `/data` Volume me save hote hain aur Railway Variables se **upar** chalte hain. `reset` likhne par wapas Variables wali value chalu ho jaati hai. Railway ke `SCHEDULE_n` wale schedules `!del` se nahi hatte, unhe `!off N` se band karo.

## Control panel
Domain kholne par (connected hone ke baad):
- Auto reply ON/OFF
- Scheduler ON/OFF
- Har schedule ke saamne **Abhi bhejo** (test)
- Logout / naya link

## Problems
| Problem | Fix |
|---|---|
| Pairing code nahi aa raha | `PHONE_NUMBER` sahi (country code, bina + ya space) hai? Logs dekho |
| Har deploy par dobara link karna pad raha | Volume `/data` par lagao |
| Reply nahi aa raha | `GEMINI_API_KEY`, `AUTO_REPLY`, `ALLOWED_NUMBERS` check karo |
| Schedule nahi gaya | `TIMEZONE`, format aur panel me Scheduler ON check karo, logs dekho |
| Session logout ho gaya | Panel me naya pairing code lo |

## Dhyan rakhein
Ye unofficial WhatsApp Web library (Baileys) use karta hai. Bahut zyada ya unknown logon ko bulk messages bhejne se number ban ho sakta hai. Zyada testing ke liye alag number use karo aur sirf jaan-pehchan walon ko schedule bhejo.
