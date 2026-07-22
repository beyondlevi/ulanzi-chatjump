# ChatJump

**One-tap shortcuts to your favorite chats, right on your Ulanzi deck.**

ChatJump turns each key of your Ulanzi Studio deck into a shortcut that opens a
**specific conversation** in WhatsApp or Telegram. No more searching your
contact list — tap the key and the chat opens instantly, showing the contact's
photo and name on the key.

> Ulanzi Studio plugin. Built for the D200 / D200H / D200X / Dial macro keypads.

## Features

- **WhatsApp Chat** action — open a conversation by phone number.
- **Telegram Chat** action — open a conversation by username or phone number.
- Each key shows the **contact photo** and **name** you configure.
- One contact per key; add as many keys as you like.
- Works with the desktop apps (WhatsApp Desktop / Telegram Desktop) via native
  deep links.

## How it works

Each action stores a small settings object per key and, on press, opens the
matching deep link handled by your OS:

| App      | Deep link                          | Configure with            |
|----------|------------------------------------|---------------------------|
| WhatsApp | `whatsapp://send?phone=<number>`   | Phone (international)      |
| Telegram | `tg://resolve?domain=<username>`   | Username (`@handle`)      |
| Telegram | `tg://resolve?phone=<number>`      | Phone (existing contact)  |

Phone numbers must be in international format (country code, digits only —
ChatJump strips spaces and symbols automatically).

## Install (development)

1. Clone this repo.
2. Copy `com.ulanzi.chatjump.ulanziPlugin/` into your Ulanzi Studio plugins
   folder, or load it via the `UlanziDeckSimulator` (`plugins/` folder).
3. Restart / refresh the plugin list.
4. Drag **WhatsApp Chat** or **Telegram Chat** onto a key and open its settings
   to set the contact name, number/username, and photo.

## Configure a key

1. Drag the action onto a key.
2. **Contact name** — shown as the key label.
3. **Phone number** (WhatsApp / Telegram-by-phone) or **Username** (Telegram).
4. **Contact photo** — choose an image; it becomes the key icon.

## Requirements

- Ulanzi Studio 3.x (Software MinVersion `2.1.4`).
- WhatsApp Desktop / WhatsApp for WhatsApp keys.
- Telegram Desktop for Telegram keys.
- Windows 10+ or macOS 10.11+.

## Roadmap

- More messengers (Signal, Slack, Discord, Messenger).
- Auto-pull contact photo from the messaging app.
- Community Store listing.

## License

MIT — see [LICENSE](LICENSE).

---

Not affiliated with WhatsApp, Telegram, or Ulanzi. Product names and logos are
trademarks of their respective owners.
