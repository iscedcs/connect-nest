# Multi-Profile Connect API Documentation

This comprehensive API documentation provides detailed information about the Multi-Profile Connect API, which enables users to manage multiple profiles with complete resource scoping, soft delete functionality, and bulk operations.

## Table of Contents

-   [Overview](#overview)
-   [Global Conventions](#global-conventions)
-   [Profiles](#1-profiles)
-   [Social Accounts](#2-social-accounts)
-   [Contacts](#3-contacts)
-   [Links](#4-links)
-   [Videos](#5-videos)
-   [Meetings](#6-meetings)
-   [Appointments](#7-appointments)
-   [Spotify Items](#8-spotify-items)
-   [Files](#9-files)
-   [Forms](#10-forms)
-   [Wallets](#11-wallets)
-   [Connect Page Configuration](#12-connect-page-configuration)
-   [Bulk Operations](#bulk-operations)
-   [Legacy Endpoints](#legacy-backward-compatible-endpoints)
-   [Sample Flows](#sample-lifecycle-flows)
-   [Status Codes](#status-codes-summary)

## Overview

This API provides a comprehensive multi-profile system where every resource lives under a specific profile. It includes features for hiding/unhiding resources, soft delete/restore functionality, and bulk operations.

### Key Features

-   **Multi-profile scoping**: Every resource belongs to a specific profile
-   **Soft delete/restore**: Resources can be soft deleted and restored
-   **Hide/Unhide functionality**: Toggle visibility without affecting deletion state
-   **Bulk operations**: Perform operations on multiple resources at once
-   **Backward compatibility**: Legacy endpoints work with the user's default profile

## Global Conventions

| Concept                         | Rule                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Authentication**              | `Authorization: Bearer <token>`                                                                                   |
| **IDs**                         | Server-generated strings (UUID recommended)                                                                       |
| **Time**                        | ISO‑8601 UTC (created_at, updated_at, deleted_at)                                                                 |
| **Soft Delete**                 | `deleted_at` set → excluded unless `include_deleted=true`                                                         |
| **Restore**                     | Clears `deleted_at`                                                                                               |
| **Hide/Unhide**                 | Toggle `is_visible` (does NOT affect deletion state)                                                              |
| **Pagination**                  | `page` (default 1), `per_page` (default 25, max 100)                                                              |
| **Sorting**                     | `sort` (field), `order` (asc/desc)                                                                                |
| **URL Validation**              | All URLs must be HTTPS                                                                                            |
| **Phone**                       | E.164 format (+1...)                                                                                              |
| **Single-instance constraints** | Per profile: videos.is_featured ≤ 1; meetings.is_default ≤ 1; appointments.is_default ≤ 1; wallets.is_default ≤ 1 |
| **Partial Update**              | PATCH accepts only fields to change                                                                               |
| **Bulk Endpoints**              | Operate only on provided IDs; silently ignore unknown IDs                                                         |

### Error Response Format

```json
{
	"error": {
		"code": "validation_error",
		"message": "URL must be HTTPS",
		"details": {
			"url": ["Must start with https://"]
		},
		"request_id": "req_0123456789"
	}
}
```

## 1. Profiles

### Profile Model

```json
{
	"id": "prof_01",
	"userId": "user_123",
	"profilePhoto": "https://cdn.example.com/p/avatar.png",
	"coverPhoto": "https://cdn.example.com/p/cover.png",
	"name": "John Doe",
	"position": "Senior Software Engineer",
	"description": "Full-stack dev.",
	"location": "San Francisco, CA",
	"address": {
		"street": "123 Main St",
		"city": "San Francisco",
		"state": "CA",
		"zipCode": "94105",
		"country": "USA"
	},
	"is_default": true,
	"createdAt": "2025-10-14T16:10:10Z",
	"updatedAt": "2025-10-14T16:10:10Z",
	"deletedAt": null
}
```

### Profile Endpoints

#### Create Profile

**POST** `/api/profile/create`

Creates a new profile (brand/persona) to organize a distinct set of resources.

**Request Body:**

```json
{
	"profilePhoto": "https://example.com/profile.jpg",
	"coverPhoto": "https://example.com/cover.jpg",
	"name": "Acme Labs",
	"position": "Innovation Team",
	"description": "R&D initiatives and prototypes.",
	"location": "Austin, TX",
	"address": {
		"street": "500 Congress Ave",
		"city": "Austin",
		"state": "TX",
		"zipCode": "73301",
		"country": "USA"
	}
}
```

**Response:** `201 Created` - Profile object

#### Get Default Profile

**GET** `/api/profile/me`

Fetches the user's default profile (legacy path).

**Response:** `200 OK` - Profile object

#### Update Default Profile

**PATCH** `/api/profile/update`

Updates default profile details.

**Request Body (partial):**

```json
{
	"description": "Updated description",
	"position": "Lead Engineer",
	"location": "Remote"
}
```

**Response:** `200 OK` - Profile object

#### Delete Default Profile

**PATCH** `/api/profile/delete`

Soft-deletes the default profile.

**Response:** `200 OK`

```json
{ "status": "deleted" }
```

#### Get Profile Stats

**GET** `/api/profile/stats`

Views server-maintained counts for default profile.

**Response:** `200 OK`

```json
{
	"socialsCount": 5,
	"contactsCount": 1,
	"unreadNotificationsCount": 0,
	"supportRequestsCount": 0,
	"cardInteractionsCount": 15
}
```

### Multi-Profile Extensions

#### List All Profiles

**GET** `/api/profiles/all`

Lists all user profiles.

**Query Parameters:**

-   `page` (default: 1)
-   `per_page` (default: 25, max: 100)
-   `include_deleted` (boolean)

**Response:** `200 OK` - Paginated Profiles

#### Get Specific Profile

**GET** `/api/profiles/one/{profileId}`

Fetches a specific profile.

**Response:** `200 OK` - Profile object

#### Update Specific Profile

**PATCH** `/api/profiles/update/{profileId}`

Modifies a specific profile.

**Request Body (partial):**

```json
{
	"name": "Acme R&D",
	"position": "Prototype Team"
}
```

**Response:** `200 OK` - Profile object

#### Delete Profile

**PATCH** `/api/profiles/delete/{profileId}`

Soft-deletes a chosen profile.

**Response:** `204 No Content`

#### Restore Profile

**PATCH** `/api/profiles/restore/{profileId}`

Restores a soft-deleted profile.

**Response:** `200 OK` - Profile object

#### Set Default Profile

**PATCH** `/api/profiles/set-default/{profileId}`

Changes which profile is the default; server unsets previous default.

**Response:** `200 OK` - Profile object (now `is_default=true`)

#### Get Current Default Profile

**GET** `/api/profiles/default`

Retrieves whichever profile is default.

**Response:** `200 OK` - Profile object

#### Clone Profile

**POST** `/api/profiles/clone/{profileId}`

Duplicates an existing profile and optionally its resources.

**Request Body (optional):**

```json
{
	"include": {
		"social": true,
		"contacts": true,
		"links": true,
		"videos": true,
		"meetings": true,
		"appointments": true,
		"spotify": true,
		"files": true,
		"forms": true,
		"wallets": true,
		"connectConfig": true
	},
	"name": "Cloned Profile - Draft"
}
```

**Response:** `201 Created` - New Profile (resources cloned with new IDs)

## Resource Modules (Per Profile)

### Base Pattern

All resource modules follow this common pattern:

| Action                | Endpoint Pattern                                           | Body             | Description       |
| --------------------- | ---------------------------------------------------------- | ---------------- | ----------------- |
| **Create**            | `POST /api/profiles/{profileId}/{module}/add`              | JSON             | Add new item      |
| **List**              | `GET /api/profiles/{profileId}/{module}/all`               | Query            | Browse items      |
| **Get One**           | `GET /api/profiles/{profileId}/{module}/one/{id}`          | –                | View details      |
| **Update**            | `PATCH /api/profiles/{profileId}/{module}/update/{id}`     | Partial JSON     | Edit item         |
| **Delete**            | `PATCH /api/profiles/{profileId}/{module}/delete/{id}`     | –                | Soft-delete item  |
| **Bulk Delete**       | `PATCH /api/profiles/{profileId}/{module}/all/delete`      | – or {ids}       | Soft-delete group |
| **Restore**           | `PATCH /api/profiles/{profileId}/{module}/restore/{id}`    | –                | Undelete          |
| **Bulk Restore**      | `PATCH /api/profiles/{profileId}/{module}/all/restore`     | – or {ids}       | Undelete group    |
| **Visibility Toggle** | `PATCH /api/profiles/{profileId}/{module}/visibility/{id}` | {is_visible}     | Hide/unhide       |
| **Bulk Visibility**   | `PATCH /api/profiles/{profileId}/{module}/visibility/all`  | {ids,is_visible} | Hide/unhide group |

## 2. Social Accounts

### Model: SocialAccount

-   `id`, `platform`, `label`, `value`, `is_visible`, `order`, `created_at`, `updated_at`, `deleted_at`

### Create Social Account

**POST** `/api/profiles/{profileId}/social/add`

Adds a social handle to the profile.

**Request Body:**

```json
{
	"platform": "Youtube",
	"label": "ISCE Youtube",
	"value": "https://youtube.com/@iisce",
	"is_visible": true,
	"order": 1
}
```

**Response:** `201 Created` - SocialAccount object

### List Social Accounts

**GET** `/api/profiles/{profileId}/social/all`

Lists social accounts (visible + optionally deleted).

**Query Parameters:** `page`, `per_page`, `include_deleted`, `sort`, `order`

**Response:** `200 OK` - Paginated SocialAccount[]

### Update Social Account

**PATCH** `/api/profiles/{profileId}/social/update/{id}`

Modifies a social account.

**Request Body (partial):**

```json
{
	"label": "ISCE Official",
	"order": 2
}
```

**Response:** `200 OK` - SocialAccount object

### Toggle Social Visibility

**PATCH** `/api/profiles/{profileId}/social/visibility/{id}`

Hides or unhides one social without deleting.

**Request Body:**

```json
{ "is_visible": false }
```

**Response:** `200 OK` - SocialAccount object

### Bulk Social Visibility

**PATCH** `/api/profiles/{profileId}/social/visibility/all`

Hides or unhides multiple socials at once.

**Request Body:**

```json
{
	"ids": ["soc_01", "soc_02", "soc_07"],
	"is_visible": true
}
```

**Response:** `204 No Content`

### Filter Socials by Platform

**GET** `/api/profiles/{profileId}/social/platform/{platform}`

Filters socials by platform.

**Response:** `200 OK` - Paginated SocialAccount[]

## 3. Contacts

### Model: Contact

-   `id`, `label`, `phone_number`, `is_primary`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Contact

**POST** `/api/profiles/{profileId}/contacts/add`

Stores a contact number for the profile.

**Request Body:**

```json
{
	"label": "Support",
	"phone_number": "+2348061719944",
	"is_primary": false,
	"is_visible": true
}
```

**Response:** `201 Created` - Contact object

### Set Primary Contact

**PATCH** `/api/profiles/{profileId}/contacts/set-primary/{id}`

Designates the main contact; others become `is_primary=false`.

**Response:** `200 OK` - Contact object

## 4. Links

### Model: Link

-   `id`, `title`, `url`, `image`, `order`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Link

**POST** `/api/profiles/{profileId}/links/add`

Adds a link to show on the profile's page.

**Request Body:**

```json
{
	"title": "Official Site",
	"url": "https://example.com",
	"image": "globe",
	"order": 1,
	"is_visible": true
}
```

**Response:** `201 Created` - Link object

### Reorder Links

**PATCH** `/api/profiles/{profileId}/links/reorder`

Reorders links after drag-and-drop in the UI.

**Request Body:**

```json
{
	"order": ["lnk_a1", "lnk_b2", "lnk_c3"]
}
```

Each ID's position becomes its numeric order (e.g., index+1).

**Response:** `204 No Content`

## 5. Videos

### Model: Video

-   `id`, `title`, `platform`, `url`, `is_featured`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Video

**POST** `/api/profiles/{profileId}/videos/add`

Adds a video for visitors to watch.

**Request Body:**

```json
{
	"title": "Product Onboarding",
	"platform": "youtube",
	"url": "https://youtu.be/abc123",
	"is_visible": true
}
```

**Response:** `201 Created` - Video object

```json
{
	"id": "vid_01",
	"title": "Product Onboarding",
	"platform": "youtube",
	"url": "https://youtu.be/abc123",
	"is_featured": false,
	"is_visible": true,
	"created_at": "2025-10-14T16:10:10Z",
	"updated_at": "2025-10-14T16:10:10Z",
	"deleted_at": null
}
```

### Feature Video

**PATCH** `/api/profiles/{profileId}/videos/feature/{id}`

Marks a video as the featured (onboarding) video; server unsets `is_featured` on others.

**Response:** `200 OK` - Video object

### Get Featured Video

**GET** `/api/profiles/{profileId}/videos/featured`

Quickly retrieves the featured video for display.

**Response:** `200 OK` - Video object (or `404 Not Found`)

### Filter Videos by Platform

**GET** `/api/profiles/{profileId}/videos/platform/{platform}`

Filters videos by platform.

**Response:** `200 OK` - Paginated Video[]

## 6. Meetings

### Model: MeetingLink

-   `id`, `provider`, `url`, `label`, `is_default`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Meeting Link

**POST** `/api/profiles/{profileId}/meetings/add`

Adds a video meeting link (provider).

**Request Body:**

```json
{
	"provider": "meet",
	"url": "https://meet.google.com/abc-defg-hij",
	"label": "Google Meet",
	"is_visible": true
}
```

**Response:** `201 Created` - MeetingLink object

```json
{
	"id": "meet_01",
	"provider": "meet",
	"url": "https://meet.google.com/abc-defg-hij",
	"label": "Google Meet",
	"is_default": false,
	"is_visible": true,
	"created_at": "2025-10-14T16:10:10Z",
	"updated_at": "2025-10-14T16:10:10Z",
	"deleted_at": null
}
```

### Set Default Meeting

**PATCH** `/api/profiles/{profileId}/meetings/default/{id}`

Chooses which meeting link is default for this profile.

**Response:** `200 OK` - MeetingLink object

### Get Default Meeting

**GET** `/api/profiles/{profileId}/meetings/default`

Fetches the default meeting link.

**Response:** `200 OK` - MeetingLink object

### Filter Meetings by Provider

**GET** `/api/profiles/{profileId}/meetings/provider/{provider}`

Filters meetings by provider.

**Response:** `200 OK` - Paginated MeetingLink[]

## 7. Appointments

### Model: AppointmentLink

-   `id`, `provider`, `url`, `label`, `is_default`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Appointment Link

**POST** `/api/profiles/{profileId}/appointments/add`

Adds a scheduling (booking) link.

**Request Body:**

```json
{
	"provider": "calendly",
	"url": "https://calendly.com/brand/intro-call",
	"label": "Intro Call",
	"is_visible": true
}
```

**Response:** `201 Created` - AppointmentLink object

### Set Default Appointment

**PATCH** `/api/profiles/{profileId}/appointments/default/{id}`

Sets the default booking link.

**Response:** `200 OK` - AppointmentLink object

### Get Default Appointment

**GET** `/api/profiles/{profileId}/appointments/default`

Retrieves the default appointment link.

**Response:** `200 OK` - AppointmentLink object

## 8. Spotify Items

### Model: SpotifyItem

-   `id`, `type`, `external_url`, `title`, `is_visible`, `order`, `created_at`, `updated_at`, `deleted_at`

### Create Spotify Item

**POST** `/api/profiles/{profileId}/spotify/add`

Showcases Spotify media on the profile.

**Request Body:**

```json
{
	"type": "playlist",
	"external_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
	"title": "Top Hits",
	"is_visible": true,
	"order": 1
}
```

**Response:** `201 Created` - SpotifyItem object

```json
{
	"id": "spot_01",
	"type": "playlist",
	"external_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
	"title": "Top Hits",
	"is_visible": true,
	"order": 1,
	"created_at": "2025-10-14T16:10:10Z",
	"updated_at": "2025-10-14T16:10:10Z",
	"deleted_at": null
}
```

### Filter Spotify by Type

**GET** `/api/profiles/{profileId}/spotify/type/{type}`

Filters by `track|playlist|album|artist|other`.

**Response:** `200 OK` - Paginated SpotifyItem[]

## 9. Files

### Model: FileItem

-   `id`, `filename`, `storage_key`, `media_type`, `size_bytes`, `checksum`, `spaces_url`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create File Item

**POST** `/api/profiles/{profileId}/files/add`

Registers an uploaded file's metadata for listing.

**Request Body:**

```json
{
	"filename": "brochure.pdf",
	"storage_key": "profiles/prof_01/files/brochure_1729890610.pdf",
	"media_type": "application/pdf",
	"size_bytes": 482193,
	"checksum": "sha256:abcdef1234567890",
	"spaces_url": "https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf",
	"is_visible": true
}
```

**Response:** `201 Created` - FileItem object

```json
{
	"id": "file_01",
	"filename": "brochure.pdf",
	"storage_key": "profiles/prof_01/files/brochure_1729890610.pdf",
	"media_type": "application/pdf",
	"size_bytes": 482193,
	"checksum": "sha256:abcdef1234567890",
	"spaces_url": "https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf",
	"is_visible": true,
	"created_at": "2025-10-14T16:10:10Z",
	"updated_at": "2025-10-14T16:10:10Z",
	"deleted_at": null
}
```

### Filter Files by Type

**GET** `/api/profiles/{profileId}/files/type/{type}`

Filters by derived file category (e.g., pdf, image, doc, other).

**Response:** `200 OK` - Paginated FileItem[]

### Download File

**GET** `/api/profiles/{profileId}/files/download/{id}`

Requests a time-limited download link.

**Response:** `200 OK`

```json
{
	"download_url": "https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
	"expires_at": "2025-10-14T17:10:10Z"
}
```

### Permanent Delete File

**DELETE** `/api/profiles/{profileId}/files/permanent/{id}`

Permanently deletes a file from both the database and Digital Ocean Spaces.

**Query Parameters:**

-   `force_delete` (boolean, default: false): When true, immediately deletes the physical file from Digital Ocean Spaces

**Response:** `204 No Content`

**Example Request:**

```
DELETE /api/profiles/prof_01/files/permanent/file_01?force_delete=true
```

**Note:**

-   Regular soft deletion (`PATCH /api/profiles/{profileId}/files/delete/{id}`) only marks the file metadata as deleted but keeps the physical file in Digital Ocean Spaces
-   Permanent deletion with `force_delete=true` removes both the database record and the physical file from Digital Ocean Spaces
-   Without `force_delete=true`, only the database record is permanently removed while the file remains in Spaces
-   This action cannot be undone

**Note:** When files are soft-deleted via the API (`PATCH /api/profiles/{profileId}/files/delete/{id}`), the file metadata is marked as deleted in the database but the physical file remains in Digital Ocean Spaces. For permanent deletion that removes the file from both the database and Digital Ocean Spaces, use the permanent delete endpoint with `force_delete=true` parameter, which will also delete the file from the configured Spaces bucket.

## 10. Forms

### Models

#### Form

-   `id`, `title`, `description`, `form_type`, `template_id`, `status[draft|active|closed]`, `fields[]`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

#### FormTemplate

-   `id`, `name`, `category`, `description`, `preview_fields[]`, `is_system`, `created_at`

#### FormField

-   `id`, `type`, `label`, `name`, `required`, `options[]`, `validations{}`

#### Submission

-   `id`, `form_id`, `submitted_at`, `answers{}`

### Create Form

**POST** `/api/profiles/{profileId}/forms/add`

Creates a new form to collect info on the profile.

**Request Body:**

```json
{
	"title": "Contact Me",
	"description": "Business inquiries",
	"form_type": "custom",
	"template_id": null,
	"status": "draft",
	"is_visible": true,
	"fields": [
		{
			"type": "text",
			"label": "Full Name",
			"name": "full_name",
			"required": true
		},
		{
			"type": "email",
			"label": "Email",
			"name": "email",
			"required": true
		},
		{
			"type": "textarea",
			"label": "Message",
			"name": "message",
			"required": true,
			"validations": { "max": 1000 }
		}
	]
}
```

**Response:** `201 Created` - Form object

### Update Form

**PATCH** `/api/profiles/{profileId}/forms/update/{id}`

Modifies form configuration (e.g., activate it).

**Request Body (partial):**

```json
{
	"status": "active",
	"fields": [
		{
			"id": "fld_1",
			"type": "text",
			"label": "Full Name",
			"name": "full_name",
			"required": true
		},
		{
			"type": "checkbox",
			"label": "Subscribe",
			"name": "subscribe",
			"required": false
		}
	]
}
```

**Response:** `200 OK` - Form object

### Get Form Submissions

**GET** `/api/profiles/{profileId}/forms/submissions/{id}`

Reviews submissions for a specific form.

**Query Parameters:** `page`, `per_page`, `from`, `to`

**Response:** `200 OK` - Paginated Submission[]

### Delete Submission

**PATCH** `/api/profiles/{profileId}/forms/submissions/delete/{submissionId}`

Soft-deletes a submission.

**Response:** `204 No Content`

### Get Form Templates

**GET** `/api/form-templates`

Retrieves available form templates (both system and user-created).

**Query Parameters:**

-   `category` (optional): Filter by template category (contact, survey, application, custom)
-   `is_system` (optional): Filter system vs custom templates

**Response:** `200 OK`

```json
{
	"data": [
		{
			"id": "tmpl_contact_basic",
			"name": "Basic Contact Form",
			"category": "contact",
			"description": "Simple contact form with name, email, and message",
			"is_system": true,
			"preview_fields": [
				{ "type": "text", "label": "Full Name", "required": true },
				{ "type": "email", "label": "Email", "required": true },
				{ "type": "textarea", "label": "Message", "required": true }
			],
			"created_at": "2025-01-01T00:00:00Z"
		},
		{
			"id": "tmpl_survey_feedback",
			"name": "Feedback Survey",
			"category": "survey",
			"description": "Customer feedback form with ratings and comments",
			"is_system": true,
			"preview_fields": [
				{
					"type": "select",
					"label": "Rating",
					"options": ["1", "2", "3", "4", "5"]
				},
				{ "type": "textarea", "label": "Comments", "required": false }
			],
			"created_at": "2025-01-01T00:00:00Z"
		}
	]
}
```

### Create Form from Template

**POST** `/api/profiles/{profileId}/forms/from-template/{templateId}`

Creates a new form based on a predefined template.

**Request Body:**

```json
{
	"title": "Contact Me",
	"description": "Business inquiries",
	"status": "draft",
	"is_visible": true,
	"customize_fields": [
		{
			"name": "full_name",
			"label": "Your Full Name"
		}
	]
}
```

**Response:** `201 Created` - Form object with template fields applied

### Create Custom Template

**POST** `/api/profiles/{profileId}/form-templates/add`

Creates a custom form template for reuse.

**Request Body:**

```json
{
	"name": "Event Registration",
	"category": "application",
	"description": "Template for event registration forms",
	"fields": [
		{
			"type": "text",
			"label": "Full Name",
			"name": "full_name",
			"required": true
		},
		{
			"type": "email",
			"label": "Email",
			"name": "email",
			"required": true
		},
		{
			"type": "select",
			"label": "Event Type",
			"name": "event_type",
			"required": true,
			"options": ["Workshop", "Conference", "Webinar"]
		}
	]
}
```

**Response:** `201 Created` - FormTemplate object

## 11. Wallets

### Model: Wallet

-   `id`, `network`, `address`, `label`, `ens`, `is_default`, `is_visible`, `created_at`, `updated_at`, `deleted_at`

### Create Wallet

**POST** `/api/profiles/{profileId}/wallets/add`

Adds a crypto wallet address to receive tips.

**Request Body:**

```json
{
	"network": "eth",
	"address": "0x1234abcdEF5678901234abcdEF5678901234abcd",
	"label": "Main ETH",
	"ens": "myname.eth",
	"is_visible": true
}
```

**Response:** `201 Created` - Wallet object

### Set Default Wallet

**PATCH** `/api/profiles/{profileId}/wallets/default/{id}`

Picks the default wallet; server unsets prior default.

**Response:** `200 OK` - Wallet object

### Filter Wallets by Network

**GET** `/api/profiles/{profileId}/wallets/network/{network}`

Filters wallets by network.

**Response:** `200 OK` - Paginated Wallet[]

## 12. Connect Page Configuration

### Model: ConnectConfig

```json
{
	"modules": [
		{
			"id": "mod_links",
			"type": "links",
			"enabled": true,
			"order": 1,
			"visibility": "public",
			"settings": { "max_items": 10, "layout": "list" }
		}
	],
	"theme": { "mode": "dark", "primary": "#0EA5E9", "accent": "#F59E0B" },
	"branding": {
		"avatar_url": "https://cdn.example.com/p/avatar.png",
		"hero_image_url": "https://cdn.example.com/p/hero.png",
		"headline": "Welcome",
		"subheadline": "All my links"
	},
	"created_at": "2025-10-14T16:10:10Z",
	"updated_at": "2025-10-14T16:10:10Z"
}
```

### Get Configuration

**GET** `/api/profiles/{profileId}/connect/config`

Loads config for building the profile page/editor.

**Response:** `200 OK` - ConnectConfig object

### Update Configuration

**PATCH** `/api/profiles/{profileId}/connect/config/update`

Adjusts theme, branding, or module properties.

**Request Body (partial):**

```json
{
	"theme": { "mode": "light", "primary": "#2563EB" },
	"branding": { "headline": "Hello World", "subheadline": "Updated tagline" },
	"modules": [
		{ "id": "mod_videos", "enabled": false },
		{ "id": "mod_links", "settings": { "max_items": 6, "layout": "grid" } }
	]
}
```

**Response:** `200 OK` - ConnectConfig object

### Reorder Modules

**PATCH** `/api/profiles/{profileId}/connect/config/reorder`

Changes the visual order of modules on the profile landing page.

**Request Body:**

```json
{
	"order": ["mod_socials", "mod_links", "mod_videos", "mod_files"]
}
```

**Response:** `204 No Content`

## Bulk Operations

### Bulk Delete/Restore Body Variants

Two supported patterns for bulk operations:

#### 1. Delete/Restore ALL items (no body)

```http
PATCH /api/profiles/{profileId}/{module}/all/delete
```

Deletes every non-deleted item.

#### 2. Delete/Restore specific items

**Request Body:**

```json
{ "ids": ["id1", "id2", "id3"] }
```

## Legacy (Backward Compatible) Endpoints

Existing single-profile endpoints (e.g., `/api/social/add`, `/api/social/all`, `/api/social/update/{id}`, etc.) are internally mapped to the current default profile. They maintain the same request/response shapes but without the `{profileId}` prefix.

**Note:** New development should prefer profile-scoped endpoints for clarity.

## Sample Lifecycle Flows

### Hide vs Delete vs Restore vs Unhide

1. **Create Link** → `POST /api/profiles/{p}/links/add`
2. **Hide** (keep for later) → `PATCH /api/profiles/{p}/links/visibility/{id}` `{ "is_visible": false }`
3. **Unhide** → same endpoint `{ "is_visible": true }`
4. **Soft Delete** (mistake/outdated) → `PATCH /api/profiles/{p}/links/delete/{id}`
5. **Restore** → `PATCH /api/profiles/{p}/links/restore/{id}` (item returns with previous `is_visible` state)

### Set Featured Video

1. Add video A
2. Add video B
3. **Feature A** → `PATCH /api/profiles/{p}/videos/feature/{idA}` (A.is_featured=true)
4. **Feature B** → `PATCH /api/profiles/{p}/videos/feature/{idB}` (A false, B true)

## Status Codes Summary

| Operation                                       | Status Codes                                    |
| ----------------------------------------------- | ----------------------------------------------- |
| **Create**                                      | 201, 400, 401, 403                              |
| **Get (list/single)**                           | 200, 401, 403, 404                              |
| **Update/Toggle/Feature/Default**               | 200/204, 400, 401, 403, 404                     |
| **Delete/Restore (single)**                     | 204 or 200 (single delete = 204, restore = 200) |
| **Bulk Delete/Restore/Reorder/Bulk Visibility** | 204, 400, 401, 403                              |
| **Not Found**                                   | 404                                             |
| **Validation**                                  | 400/422                                         |

---

_This documentation covers the complete Multi-Profile Connect API with all endpoints, models, and operational patterns._
