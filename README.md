# ChatJump

**One-tap shortcuts to your favorite chats, right on your Ulanzi deck.**

ChatJump turns each key of your Ulanzi Studio deck into a shortcut that opens a
**specific conversation** in WhatsApp or Telegram. No more searching your
contact list — tap the key and the chat opens instantly in the desktop app,
showing the contact's photo and name on the key.

> Ulanzi Studio plugin. Built for the D200 / D200H / D200X / Dial macro keypads.

![ChatJump](resources/cover.png)

## Features

- **WhatsApp Chat** — open a direct conversation by phone number.
- **Telegram Chat** — open a conversation by username, phone number, or a
  **private group invite link**.
- **Telegram groups & channels** — public ones by `@username`, private groups by
  their invite link (`https://t.me/+...`).
- **Contact photo + app badge** — set any photo as the key icon; a small
  WhatsApp/Telegram badge is added to the corner so you always know which app the
  key opens.
- **Import from WhatsApp (Evolution API)** — connect your
  [Evolution API](https://doc.evolution-api.com/) server to search your WhatsApp
  contacts and import a contact's number and profile photo into a key with one
  click.
- **Bilingual** — interface localized in **English** and **Portuguese (pt_PT)**.
- Opens the messenger app directly via its URL scheme (not a browser tab).

## Import contacts from WhatsApp (Evolution API)

In a **WhatsApp Chat** key's settings, open **Import from WhatsApp (Evolution
API)** and fill in your Evolution server URL, API key and instance (stored once,
shared by every ChatJump key). Then:

1. **Test connection** confirms the server/key/instance are valid.
2. **Import contact** lists your WhatsApp contacts with a search box.
3. Pick a contact — its **name**, **number** and **profile photo** (with the
   WhatsApp badge) are filled into the key automatically.

Calls run in the plugin's background service (async, never blocking) using
`POST /chat/findContacts/{instance}` and `POST /chat/fetchProfilePictureUrl/{instance}`
with the `apikey` header. The API key is stored in Ulanzi Studio's local
settings.

## How it works

Each action stores a small settings object per key and, on press, hands the
matching deep link to your OS, which launches the installed desktop app:

| App / mode                 | Deep link                        | Configure with               |
|----------------------------|----------------------------------|------------------------------|
| WhatsApp — direct chat     | `whatsapp://send?phone=<number>` | Phone (international)         |
| Telegram — username        | `tg://resolve?domain=<username>` | `@handle` (user/group/channel) |
| Telegram — phone           | `tg://resolve?phone=<number>`    | Phone (existing contact)     |
| Telegram — group invite    | `tg://join?invite=<hash>`        | Invite link `https://t.me/+...` |

Phone numbers must be in international format (country code); ChatJump strips
spaces and symbols automatically. Telegram invite links are accepted in any
form (`t.me/+hash`, `t.me/joinchat/hash`, `tg://join?invite=hash`, or the raw
hash) — ChatJump extracts what it needs.

### Why no WhatsApp groups?

WhatsApp does not expose a `whatsapp://` scheme for group chats — the only handle
is the `https://chat.whatsapp.com/<code>` invite link, which on desktop always
opens in a browser. To keep every key a clean, direct in-app jump, ChatJump
supports **WhatsApp direct chats** and **Telegram chats + groups**.

## Install

### From the plugin package

1. Download `com.ulanzi.chatjump.ulanziPlugin.zip` from the
   [latest release](../../releases/latest).
2. Install it in Ulanzi Studio (or unzip it into the Ulanzi Studio `plugins`
   folder), then restart / refresh the plugin list.

### From source (development)

1. Clone this repo.
2. Copy `com.ulanzi.chatjump.ulanziPlugin/` into your Ulanzi Studio plugins
   folder, or load it via the `UlanziDeckSimulator` (`plugins/` folder).
3. Restart / refresh the plugin list.

## Configure a key

1. Drag **WhatsApp Chat** or **Telegram Chat** onto a key.
2. **Contact name** — shown as the key label.
3. For WhatsApp: the **phone number**. For Telegram: pick **Open by**
   (Username / Phone number / Group invite link) and fill the matching field.
4. **Contact photo** — choose an image; it becomes the key icon, with the app
   badge added in the corner.

## Requirements

- Ulanzi Studio 3.x (Software MinVersion `2.1.4`).
- WhatsApp Desktop / WhatsApp for WhatsApp keys.
- Telegram Desktop for Telegram keys.
- Windows 10+ or macOS 10.11+.

## Roadmap

- More messengers (Signal, Slack, Discord, Messenger).
- Auto-pull contact photo from the messaging app.

## License

MIT — see [LICENSE](LICENSE).

---

Not affiliated with WhatsApp, Telegram, or Ulanzi. Product names and logos are
trademarks of their respective owners.
