✅ PUBLIC PROFILE API — Full Backend Specification

Endpoint Name:

GET /api/public/profile/{deviceId}

Returns the complete public-facing profile data for any device tap (card, wristband, sticker, keychain).

🔥 1. Purpose

When a stranger taps a device (NFC / QR), you want to show:

Profile details (name, bio, position, photos)

All visible connect modules:

Links

Socials

Youtube + Videos

Files / PDFs

Contact info (public contacts only)

Spotify

Calendly/Meetings

Appointments

Wallets (crypto wallets)

Forms (visible forms)

Events module

Store module

Stats (optional)

Device metadata (tap count, etc)

Currently these require many fragmented calls, and some require authentication.
This new endpoint solves all that.

🔐 2. Access Level

Public — No authentication required

Rules:

Only returns data from the user’s default profile

Only returns items where is_visible = true

Soft-deleted items are excluded

Private sections are excluded automatically

📥 3. Request
GET /api/public/profile/{deviceId}
Path Param:
Param	Type	Description
deviceId	string	The NFC/QR device UID
Example:
GET /api/public/profile/6214bdef6dbcbABC12345

🚀 4. Backend Logic Flow
Step 1: Device → User
SELECT userId FROM Devices WHERE deviceId = :deviceId


If not found → return 404.

Step 2: Get user's default profile
SELECT * FROM Profiles 
WHERE userId = :userId AND is_default = true LIMIT 1


If none is default:

→ fallback: first created profile.

Step 3: Load all modules (only visible)

The backend should gather the following:

Module	Table	Filter
Contacts	profile_contacts	is_visible = true
Links	profile_links	is_visible = true
Socials	profile_socials	is_visible = true
Videos	profile_videos	is_visible = true
Files	profile_files	is_visible = true
Spotify	profile_spotify	is_visible = true
Meetings	profile_meetings	is_visible = true
Appointments	profile_appointments	is_visible = true
Wallets	profile_wallets	is_visible = true
Forms	profile_forms	is_visible = true
Events	profile_events	public-only
Store items	store_products	visible-only

ORDER BY:

Use each module’s order column where applicable.

Default: newest first.

Step 4: Return unified JSON
📤 5. Response (FULL EXAMPLE)
{
  "success": true,
  "message": "Public profile loaded",
  "data": {
    "profile": {
      "id": "0f53eaf0-229f-4dbc-aebe-03c60a1cd726",
      "name": "Paul Oyeniran",
      "position": "Software Engineer",
      "bio": "Lover of clean UI",
      "profilePhoto": "https://..../profile.png",
      "coverPhoto": "https://..../cover.jpg",
      "location": "Lagos, Nigeria"
    },

    "contact": {
      "primary": {
        "label": "Mobile",
        "phone_number": "+2349070000000"
      },
      "others": [
        {
          "id": "...",
          "label": "Office",
          "phone_number": "+234808..."
        }
      ]
    },

    "links": [
      {
        "id": "lk_1",
        "title": "Portfolio Website",
        "url": "https://websync.com.ng",
        "icon": "globe"
      }
    ],

    "socials": [
      {
        "id": "sc_1",
        "platform": "instagram",
        "username": "@paulcodes",
        "url": "https://instagram.com/paulcodes",
        "icon": "instagram"
      }
    ],

    "videos": [
      {
        "id": "vid_1",
        "platform": "youtube",
        "title": "My Tech Talk",
        "thumbnail": "https://...",
        "url": "https://youtube.com/watch?v=abc"
      }
    ],

    "files": [
      {
        "id": "f_1",
        "title": "Resume",
        "type": "pdf",
        "url": "https://.../resume.pdf"
      }
    ],

    "spotify": [
      {
        "id": "sp_1",
        "type": "track",
        "title": "My Playlist",
        "artist": "Drake",
        "url": "https://open.spotify.com/track/xyz"
      }
    ],

    "meetings": [
      {
        "id": "mt_1",
        "provider": "calendly",
        "url": "https://calendly.com/paul"
      }
    ],

    "appointments": [
      {
        "id": "ap_1",
        "provider": "google",
        "url": "https://calendar.google.com/.../"
      }
    ],

    "wallets": [
      {
        "id": "w_1",
        "network": "bitcoin",
        "address": "1Hsd8723..."
      }
    ],

    "forms": [
      {
        "id": "frm_1",
        "title": "Contact Me",
        "description": "Business inquiries",
        "url": "https://isce.tech/forms/frm_1"
      }
    ],

    "events": [
      {
        "id": "ev_1",
        "title": "Tech Summit",
        "date": "2025-09-12",
        "cover": "https://...",
        "url": "/events/ev_1"
      }
    ],

    "store": [
      {
        "id": "st_1",
        "name": "Hoodie",
        "price": 15000,
        "image": "https://..."
      }
    ],

    "device": {
      "deviceId": "6214bdef7dbcb",
      "type": "CARD",
      "tapCount": 104,
      "lastTap": "2025-12-02T14:12:08Z"
    }
  }
}

🧠 6. Visibility Rules

Only return resources where:

is_visible = true AND deletedAt IS NULL

Performance

Option A: 12 SQL calls (simple)

Option B: join everything into a single aggregated query (fastest)

Caching

Should be cached for 5–10 seconds maximum
(since data can change frequently by the user)

Errors

404 → if device user not found

400 → malformed deviceId

200 + success=false → in edge cases