# PSC-DRFMS — Digital Records & File Management System

A web-based electronic records management system (ERMS) built for the Public Service Commission. It combines a Google-Drive-style file browser with the controls a records office needs: a formal classification scheme, security clearances, approval workflows with tamper-evident proofs, retention and disposition, legal holds, a full audit and chain-of-custody trail, encrypted backups, and optional AI assistance that respects document classification.

---

## Table of contents

1. [Architecture and tech stack](#1-architecture-and-tech-stack)
2. [Quick start](#2-quick-start)
3. [Configuration](#3-configuration)
4. [Features](#4-features)
   - [Records and the file browser](#41-records-and-the-file-browser)
   - [Capture and upload](#42-capture-and-upload)
   - [Versions, attachments and relations](#43-versions-attachments-and-relations)
   - [Editing documents in the browser (OnlyOffice)](#44-editing-documents-in-the-browser-onlyoffice)
   - [Classification, access control and permissions](#45-classification-access-control-and-permissions)
   - [Metadata, templates and document types](#46-metadata-templates-and-document-types)
   - [Search](#47-search)
   - [AI features](#48-ai-features)
   - [Workflows and approvals](#49-workflows-and-approvals)
   - [Collaboration](#410-collaboration)
   - [Sharing](#411-sharing)
   - [Compliance, retention and disposition](#412-compliance-retention-and-disposition)
   - [Recycle bin](#413-recycle-bin)
   - [Correspondence register](#414-correspondence-register)
   - [Notifications](#415-notifications)
   - [Audit trail and chain of custody](#416-audit-trail-and-chain-of-custody)
   - [Analytics and dashboards](#417-analytics-and-dashboards)
   - [Administration](#418-administration)
   - [Backups](#419-backups)
   - [Integrations and public API](#420-integrations-and-public-api)
   - [Authentication and security](#421-authentication-and-security)
   - [User interface](#422-user-interface)
5. [Roles and clearance matrix](#5-roles-and-clearance-matrix)
6. [API overview](#6-api-overview)
7. [Background jobs](#7-background-jobs)
8. [Project structure](#8-project-structure)
9. [Testing](#9-testing)
10. [Operations notes](#10-operations-notes)
11. [Known gaps and roadmap](#11-known-gaps-and-roadmap)

---

## 1. Architecture and tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router 6, Recharts, i18next, Headless UI, lucide-react, axios, MSAL (Microsoft sign-in for OneDrive import) |
| Backend | Python, Django 5.0, Django REST Framework, Channels (WebSockets), served by Uvicorn (ASGI) |
| Database | PostgreSQL 16 with the `pgvector` extension (full-text search, trigram matching and embeddings) |
| Cache / broker | Redis 7 (Celery broker, Channels layer, caching) |
| Background work | Celery worker + Celery beat (`django-celery-beat` database scheduler) |
| File storage | MinIO (S3-compatible object storage) via `django-storages` / `boto3` |
| Document editing | OnlyOffice Document Server (JWT-secured) |
| Auth | JWT (`djangorestframework-simplejwt`) with token blacklist, TOTP 2FA (`pyotp`, `django-otp`) |
| API docs | `drf-spectacular` (OpenAPI, Swagger UI, ReDoc) |
| OCR / documents | Tesseract (`pytesseract`), `pdf2image`, `pypdf`, PyMuPDF, `openpyxl`, `reportlab`, WeasyPrint |
| Web server | nginx in the frontend container (static files, security headers, `/api/` reverse proxy with WebSocket upgrade) |
| Orchestration | Docker Compose |

Services started by `docker-compose.yml`: `db`, `redis`, `minio`, `onlyoffice`, `backend`, `celery_worker`, `celery_beat`, `frontend`. Every long-running service has a health check, and the backend waits for a healthy database and Redis before starting.

---

## 2. Quick start

### Prerequisites
- Docker Desktop (or Docker Engine with Compose v2)
- About 6 GB of free RAM (OnlyOffice is the heaviest container)

### Windows (PowerShell)

```powershell
.\scripts\start-dev.ps1
```

The script checks that Docker is running, creates `.env` from `.env.example` if it is missing, builds and starts the containers, and waits for the backend health check to pass.

### Any platform

```bash
cp .env.example .env
docker compose up -d --build
```

On start, the backend container runs `makemigrations`, `migrate` and `collectstatic`, creates the default administrator account, and starts Uvicorn with auto-reload.

### Default addresses

| Service | URL |
|---|---|
| Web application | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Swagger UI / ReDoc | http://localhost:8000/api/docs/ and `/api/redoc/` |
| Health check | http://localhost:8000/api/health/ |
| MinIO console | http://localhost:9001 |
| OnlyOffice | http://localhost:8082 (first start takes a couple of minutes) |

### Default administrator

The first-start administrator comes from the environment variables `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_USERNAME` and `DJANGO_SUPERUSER_PASSWORD`. If they are not set, the defaults in `backend/apps/accounts/fixtures.py` apply. **Change the password immediately and never use the defaults outside a development machine.**

### Sample data

`scripts/seed-system.ps1` and the `seed_system` management command load sample records, series and users from `backend/seed_samples/`:

```bash
docker compose exec backend python manage.py seed_system
```

---

## 3. Configuration

All configuration is by environment variables in `.env` (see `.env.example`).

| Group | Variables |
|---|---|
| Django | `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DJANGO_SETTINGS_MODULE` |
| Database | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` |
| Redis | `REDIS_URL` |
| Object storage | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_USE_HTTPS` |
| OnlyOffice | `ONLYOFFICE_JWT_SECRET`, `ONLYOFFICE_PUBLIC_URL`, `ONLYOFFICE_PORT` |
| Semantic search | `EMBEDDING_PROVIDER` (`gemini` or `ollama`), `GEMINI_API_KEY`, `EMBEDDING_EXTERNAL_MAX_CLASSIFICATION`, `SEMANTIC_SEARCH_ENABLED` |
| Generative AI | `LLM_PROVIDER` (`none`, `anthropic`, `gemini`, `ollama`), `LLM_LOCAL_PROVIDER`, `LLM_EXTERNAL_MAX_CLASSIFICATION`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_LLM_MODEL`, `OLLAMA_LLM_MODEL`, `OLLAMA_VISION_MODEL`, `AI_AUTOFILE_CONFIDENCE`, `LLM_RATE_LIMIT_PER_MINUTE` |
| Email | `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` |
| Sessions | `SESSION_COOKIE_AGE` (default 8 hours) |
| Backups | `BACKUP_TIME_LIMIT_HOURS`, `BACKUP_DUMP_TIMEOUT` |

Production deployments should use a strong `SECRET_KEY`, `DEBUG=False`, HTTPS in front of nginx, and non-default MinIO and OnlyOffice secrets.

---

## 4. Features

### 4.1 Records and the file browser

- **Drive-style browser** (`/browse`) with list and grid views, sortable and resizable columns, breadcrumbs, a folder tree sidebar, a details pane, thumbnails, and a status bar showing storage use.
- **Record series (classification scheme):** a formal, nested hierarchy of series. Each series is a folder in the browser; records can be moved between series with a move dialog or bulk action, and searching or filtering by a series includes everything nested under it.
- **Reference numbers:** each record gets a unique, sequential reference number (generated by a per-year sequence table).
- **Quick access:** pin any location (for example a series or filtered view) to the sidebar.
- **Starred, Recent, Shared with me** and **Tags** pages for the common ways people find their work.
- **Right-click context menus**, a floating selection bar, and **bulk actions** (move, update metadata, delete) on multiple selected records.
- **Undo** for destructive actions such as delete, through an undo toast.
- **Keyboard shortcuts** in the browser: `Ctrl/Cmd+A` select all, `Ctrl/Cmd+F` or `/` focus search, arrow keys / `Home` / `End` to move, `Enter` to open, `Space` to preview, `I` for the details pane, `Delete` to delete, `Esc` to clear, `F5` to refresh.
- **Command palette** (`Ctrl/Cmd+K`) for jumping to any page or running actions.
- **Physical-file cross-reference:** each record can store the physical file reference and location, and a generated **QR code** links a paper file to its digital record.
- **Vital records** flag for records that must be protected and recovered first.
- **Lifecycle "subway map":** a five-station visual of each record's journey: capture → review → approved → retention → disposition, with the status of each station.

### 4.2 Capture and upload

- **Upload page** (`/upload`) and drag-and-drop anywhere in the drive, including a **mega-upload dialog** for many files at once.
- **Transfer panel** showing the progress of every upload in the background.
- **Duplicate detection:** a content hash is computed on upload, and the system warns about records with identical content before creating a copy.
- **OneDrive import** (optional, administrator-enabled): browse and import files directly from Microsoft 365 using the user's own Microsoft sign-in.
- **New document / new folder:** create blank Word, Excel or PowerPoint documents and folders from the **New** menu.
- **Automatic processing after upload** (Celery): OCR, search-vector refresh, thumbnail generation, QR-code generation, duplicate check, optional AI tagging, and embedding for semantic search.
- **OCR** with Tesseract for scanned PDFs and images, with an optional **AI vision fallback** that transcribes handwriting and poor scans the OCR engine cannot read (English, French and Bislama).

### 4.3 Versions, attachments and relations

- **Immutable version history:** every upload of a new file creates a new version; old versions are never overwritten. Each version can be previewed, downloaded, or integrity-verified (checksum comparison).
- **Version diff:** compare two versions of a document.
- **Attachments:** extra files on a record that are not versions of the main file, such as annexes, enclosures and PDF copies. Attachment text is extracted and made **searchable** (PDF, images with OCR, Office documents, plain text), with thumbnails.
  - Attachments appear in the list view with a paperclip and expandable rows, as a badge in the grid, and in the details pane.
  - **Make an attachment its own record** (promote), or **attach an existing record** to another (the folded-in record moves to the recycle bin and shows an "Attached to" link).
  - Attachments can be removed and restored.
  - `index_attachments` management command to back-fill the text index.
- **Record relations:** typed links between records: *related*, *replies to*, *supersedes*, *refers to*, *annex of*.
- **Similar records:** a panel on each record suggests semantically similar documents.

### 4.4 Editing documents in the browser (OnlyOffice)

- Open Word, Excel and PowerPoint files in an embedded **OnlyOffice** editor; edits save back as new versions through a signed callback.
- JWT-protected configuration and document URLs; short-lived tokens in the document and callback addresses.
- **Convert to PDF** from the editor.
- Content-Security-Policy in nginx is built from the configured OnlyOffice origin.

### 4.5 Classification, access control and permissions

- **Five classification levels:** Unclassified, Internal, Confidential, Restricted, Secret.
- **Role clearance matrix** (see [section 5](#5-roles-and-clearance-matrix)): each role may open records up to a maximum level without any explicit grant.
- **Object-level enforcement on the server.** Access to a record is granted by any of: role clearance, being the record's custodian or author, or an unexpired explicit grant. Front-end route guards are cosmetic; the API checks every request.
- **Per-document permissions:** grant a specific user or a whole department view, edit and/or download rights on a record, optionally with an **expiry date**, from the Permissions panel.
- **Automatic access rules (admin):** "everyone in department X gets rights Y on every record that matches Z." Rules apply to matching records automatically.
- **Custodian and author** tracked per record, with originating ministry.

### 4.6 Metadata, templates and document types

- **Twelve document types:** correspondence, personnel file, board paper, policy, circular, report, commission submission, disciplinary file, contract, financial, legal, other.
- **Metadata profiles (admin):** for each document type, define which fields are required and which extra custom fields the record carries (for example *party* and *amount* on a contract). The record page shows a **metadata card** with what is missing, and required fields are checked before a record can enter a workflow.
- **Custom fields** stored per record and searchable.
- **Document templates (admin):** a starting Word, Excel or PowerPoint file plus pre-filled metadata. Users create a new document from a template; a starter set can be loaded.
- **Tags:** free-form tags on any record, a tag editor, and a Tags page to browse by tag.
- **Metadata suggestions:** on-server keyword scoring and pattern matching proposes document type, dates and other fields from the OCR text (no data leaves the server).

### 4.7 Search

- **Unified search** with PostgreSQL full-text ranking, typo-tolerant trigram matching on titles and reference numbers, facets (document type, classification, series, year), and result highlighting.
- **Search suggestions** as you type.
- **Advanced search** (`/search/advanced`): build a list of conditions (field + operator + value) joined by ALL or ANY, up to 15 conditions. Text, choice and date operators (contains, equals, starts with, is empty, before, after, between, and more). Every field and operator is on an allow-list, and nothing from the request reaches the database as raw text.
- **Semantic search ("match by meaning"):** documents are split into passages and embedded with pgvector; a query finds records by meaning even when the words differ. Falls back to keyword search if the embedding provider is unavailable.
- **Similar records** by embedding distance.
- **Search analytics:** the system records searches that returned no result so records officers can see what users cannot find.
- Search results are always limited to records the user is allowed to view.

### 4.8 AI features

AI is **off by default** (`LLM_PROVIDER=none`) and every feature is a *suggestion* — nothing is applied automatically except an opt-in auto-fill of empty fields (`AI_AUTOFILE_CONFIDENCE`), and **never** classification, series or retention.

- **Providers:** Anthropic Claude, Google Gemini, or a local **Ollama** server. A hybrid setup sends higher classifications to your own local server.
- **Classification gate:** an external provider only ever sees text from records at or below `LLM_EXTERNAL_MAX_CLASSIFICATION`. Anything above goes to the local provider if one is configured, otherwise it gets no AI at all. The same gate applies to embeddings.
- **Ask the archive** (`/ask`): ask a question in plain language and get an answer with sources. Retrieval only sees records the asking user may view.
- **Chat with a document:** ask questions about a single record.
- **Summaries** of a record.
- **Analysis and suggestions** for a record: document type, ministry, date, tags, record series, retention period and sensitivity, each with a confidence value.
- **Sensitive-content detection** (runs on the server without any AI): identifies bank or card numbers, identity-document numbers, medical information, disciplinary matters, salary details, and so on, masks examples, and proposes a **minimum classification**.
- **Plain-English search:** turn "contracts from last year about vehicles" into the structured search filters.
- **AI review queue** (`/ai-review`): records officers review, apply or dismiss suggestions, and mark a record as reviewed.
- **Call log:** each AI call is recorded (provider, model, user, record) for oversight.
- **Rate limiting** per user (`LLM_RATE_LIMIT_PER_MINUTE`).
- **`ai_backfill`** management command to analyse existing records.
- Untrusted document text is handled as data: prompts tell the model not to follow instructions in it, and model output is validated field by field before it is stored.

### 4.9 Workflows and approvals

- **Workflow templates (admin):** an ordered list of steps; each step has a name, a required role or a specific user, a deadline in working days, and an optional parallel flag. Templates can be tied to a document type.
- **Workflow instances:** start a workflow on a record; the system creates the first task and moves the instance through the steps as each is approved.
- **Statuses:** pending, in progress, approved, rejected, revision required, cancelled.
- **Actions:** approve, reject, request revision, escalate, with comments; **delegation** of tasks to another user.
- **My tasks** page (`/workflows/my-tasks`) with deadlines.
- **Notifications** to the next approver and to the initiator at each step.
- **Cryptographic workflow proof:** when a workflow concludes, a canonical JSON snapshot of the record, versions and all actions is stored with its **SHA-256 digest**. A verify endpoint recomputes the digest (detecting tampering with the proof) and rebuilds a fresh snapshot from the live database (detecting later changes to the record, versions or actions).

### 4.10 Collaboration

- **Comments** on records, with **@mentions** that notify the person mentioned; edit and delete your own comments.
- **Review rounds:** send a record to named reviewers with a due date; reviewers respond; the round is closed by the owner.
- **Assignments:** a light-weight "please review this by Friday" request to a colleague, with accept / complete style actions and a *My assignments* list. Lighter than a full workflow.
- **Live presence:** avatars show who else is viewing a record right now (heartbeat-based, stale entries ignored), delivered over WebSockets.
- **Activity panel** on every record shows its recent history.

### 4.11 Sharing

- **Internal sharing** through document permissions (see 4.5) and the **Shared with me** page.
- **Public share links** for people without an account: random 256-bit token, optional **password**, **expiry date**, option to **allow or block download**, optional recipient name and email, pinned to a specific version if wanted.
- **Link management** page (`/sharing`): see every link, how many times each was opened, and **revoke** at any time.
- **Access logging:** each open of a shared link is recorded in its own access table (`SharedLinkAccess`) **and** in the main audit log (`share_access`, against the record, identifying the link by id, never by its token).
- Recipients view the document at `/shared/<token>`.

### 4.12 Compliance, retention and disposition

- **Retention schedules:** define how long each class of record is kept and what happens at the end.
- **Nightly retention scan** (02:00) flags records that are due, creating **disposition reviews**; also runnable on demand (`scan_retention` command or the Scan button).
- **Disposition review:** each flagged record carries a proposed action (destroy, archive, review, or transfer to the National Archives); an authorised user approves or dismisses it, and the decision and decider are recorded. Only one review can be pending per record.
- **Overdue records** report: everything past its retention date.
- **Legal holds:** freeze records (or whole series) for a disciplinary proceeding, commission inquiry, litigation, audit or other reason. A record on hold cannot be disposed of; lifting a hold re-evaluates whether any other active hold still applies.
- **Destruction scheduling and certificates:** destruction is a controlled, two-person process.
  1. A record can only be put on a certificate if it has an **approved disposition review for destruction** and is not under legal hold, not vital, not in an open workflow, not in the Recycle bin and not already on another certificate. The requester names the records when asking.
  2. A **different** Director/Commissioner/Administrator must approve. The API refuses the requester (HTTP 403) and the database enforces it with a check constraint. Approval and rejection are written to the audit log against each record; rejection records who rejected and releases the records.
  3. Approval queues the **execution job** (a daily sweep also retries). It refuses to run, leaving the certificate approved and logging why, if any record has since come under legal hold, entered a workflow or been binned.
  4. Execution erases every stored file, attachment, thumbnail and QR code, OCR/AI text, the search vector, the semantic-search passages (embeddings) and comment text, switches off shared links, and keeps only a **metadata stub** (reference, title, classification, series, dates, version file names, sizes and SHA-256 hashes) plus the audit trail. It writes a `destroy` audit entry per record, produces the **certificate PDF**, and sets the certificate to *completed*.
  Destroyed records are hidden everywhere, are not in the Recycle bin and cannot be restored (`Record.erased_at` marks them; `destroyed_at` alone means a Recycle-bin record). Backups taken before execution still contain the content until they expire.
- **Compliance dashboard** summarising holds, overdue records, pending reviews and upcoming destructions.

### 4.13 Recycle bin

- Deleting a record moves it to the **Recycle bin** (`/bin`), hidden everywhere else, with who deleted it and when.
- **Restore** from the bin at any time.
- A deleted record is never erased from the bin; permanent removal happens only through the destruction-certificate process.

### 4.14 Correspondence register

- A register of incoming and outgoing correspondence (`/correspondence`) linked to records, with list and detail views and a sequential reference.

### 4.15 Notifications

- **In-app inbox** (`/inbox`) with unread count, mark-read and mark-all-read.
- **Real-time delivery** over a WebSocket connection, authenticated by JWT.
- **Types:** info, success, warning, error, workflow, comment, mention, deadline, share, legal hold.
- **Activity feed** of what colleagues have been doing on records you can see.
- Notifications link straight to the related record or workflow.

### 4.16 Audit trail and chain of custody

- **Append-only, hash-chained audit log** of meaningful actions (each view calls the logger explicitly): view, create, update, delete, download, upload version, approve, reject, share, shared-link access, legal hold, destroy, and more, with user, IP address, time and details.
  - A database trigger rejects any UPDATE or DELETE of an entry, except clearing the user/record link when that user or record is later erased; the entry keeps the user's e-mail and name and the record's reference as text, so it still says who did what.
  - Each entry stores the SHA-256 of its content and of the entry before it. `python manage.py verify_audit_chain` walks the chain and names the first altered or missing entry. Rows written before the chain existed were chained when the migration ran.
  - The Django admin shows the log read-only.
- **Audit trail page** (`/analytics/audit`) with filters, and a per-record **audit tab**.
- **Chain of custody** per record: a chronological custody record of who held or handled it.
- Audit middleware captures request context automatically.

### 4.17 Analytics and dashboards

- **Home dashboard** with statistics, a recent-activity feed and a team feed.
- **Analytics dashboard** (`/analytics`): records by type, records by month, workflow performance, user activity, compliance overview.
- Charts use theme-aware colours; results are cached for speed.

### 4.18 Administration

- **User management** (`/admin/users`): create and edit users, set role and department, **suspend / reactivate**, **reset password**, require 2FA.
- **Departments** with a parent-child hierarchy.
- **Templates admin, Access rules admin, Metadata admin** (see 4.5 and 4.6).
- **System health** page (`/admin/health`).
- **Backups** (`/admin/backups`) — see 4.19.
- **Microsoft 365 settings** (`/admin/microsoft365`): enable OneDrive import and enter the Azure app's client ID and tenant ID.
- **Django admin** at `/admin/` for low-level data access.

### 4.19 Backups

Scheduled backups of the database and every stored file to a Windows/Samba (**SMB**) file share, configured entirely from the admin page.

- **Schedule:** daily or weekly, at a chosen hour (and weekday); an hourly beat job starts a run only when one is due.
- **What is backed up:** a PostgreSQL dump (custom format) plus a mirror of every stored document. Only new or changed files are sent after the first run.
- **Safe writes:** every file is written under a temporary `.part` name, its size is checked, and only then renamed into place; the dump is verified with `pg_restore --list` before it is sent. An interrupted run never leaves something that looks complete.
- **Retention of copies:** keep the newest N database dumps (default 14). Files are never deleted by a run.
- **Optional encryption:** everything is encrypted before it leaves the server using a passphrase only the administrator holds. A `decrypt_backup` command restores encrypted dumps.
- **Test connection** button, run history with status, and an **alert** when a backup fails.
- Credentials are stored encrypted.
- Full, step-by-step restore instructions: [`backend/apps/backups/RESTORE.md`](backend/apps/backups/RESTORE.md).

### 4.20 Integrations and public API

- **API keys:** per-user keys with scopes, a rate limit per minute, expiry, last-used time, and revoke. Keys carry a visible prefix for identification.
- **Webhook endpoints:** register a URL, a signing secret and the list of events it subscribes to.
- **OpenAPI documentation** at `/api/docs/` and `/api/redoc/`.
- **Health endpoint** at `/api/health/` for load balancers and monitoring.
- **OneDrive / Microsoft 365** import (see 4.2).

### 4.21 Authentication and security

- **JWT authentication** with 1-hour access tokens, refresh tokens, and a **blacklist on logout**.
- **Two-factor authentication (TOTP):** QR-code setup, verification, and 2FA state carried as a claim in the JWT (not as mutable server state). Administrators can require 2FA per user.
- **Account lockout:** 5 failed logins lock the account for 30 minutes.
- **Password change** and administrator password reset.
- **Session length** configurable (default 8 hours).
- **Role-based and object-level authorisation** enforced on the API.
- **Security headers** from nginx: strict Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- **Input safety:** advanced-search fields and operators are allow-listed; AI output is validated; OnlyOffice and shared links use unguessable tokens.
- **Audit logging** of sensitive actions (see 4.16).
- **Tamper-evident proofs** for workflow decisions and on-demand integrity checks on file versions.

### 4.22 User interface

- **Light, dark and system themes**, selectable theme presets, density (compact / comfortable) and corner-radius options.
- **Per-user appearance** with an **organisation default** that an administrator can lock.
- **Three language files:** English, French and Bislama, auto-detected and switchable in settings. Only part of the interface is translated so far; the rest is English.
- **Responsive layout** with a collapsible sidebar, horizontal menu and settings panel.
- **Accessible components**, skeleton loaders, empty states, confirm popovers and an error boundary.
- **Resizable columns** that remember their width.

---

## 5. Roles and clearance matrix

| Role | Highest classification readable without an explicit grant | Can create / edit records |
|---|---|---|
| Read Only | Internal | No |
| Reviewer | Confidential | No |
| Records Officer | Restricted | Yes |
| Director | Restricted | Yes |
| Commissioner | Secret | Yes |
| Administrator | Secret | Yes |

Regardless of role, a user can always access records they are the **custodian** or **author** of, and any record on which they hold an unexpired **document permission** (directly or through their department). Administrator-only areas: user management, templates, access rules, metadata profiles, backups, Microsoft 365 settings and system health.

---

## 6. API overview

All endpoints are under `/api/` and return camelCase JSON. Interactive documentation: `/api/docs/`.

| Prefix | Purpose |
|---|---|
| `/api/auth/` | Login, refresh, logout, current user, password, 2FA, delegation, users, departments |
| `/api/records/` | Records CRUD, versions, attachments, relations, star, tags, bulk, series, pins, bin, templates, permission rules, metadata profiles, thumbnails, QR codes, duplicates, lifecycle, storage |
| `/api/search/` | Unified, suggest, similar, semantic status, advanced, analytics |
| `/api/ai/` | Status, ask, review queue, search parsing, record chat / summary / analyse / apply retention / mark reviewed |
| `/api/workflows/` | Templates, instances, actions, proofs, my tasks |
| `/api/collaboration/` | Comments, review rounds, assignments |
| `/api/sharing/` | Shared links, public view and download by token |
| `/api/compliance/` | Legal holds, destruction, retention, scan, disposition reviews, overdue |
| `/api/correspondence/` | Correspondence register |
| `/api/notifications/` | Inbox, activity feed, mark read |
| `/api/audit/` | Audit logs, custody chain |
| `/api/analytics/` | Dashboards and charts |
| `/api/appearance/` | Personal and organisation appearance |
| `/api/backups/` | Settings, connection test, runs |
| `/api/management/` | API keys and webhooks |
| `/api/onlyoffice/` | Editor config, document, callback, PDF conversion |
| `/api/integrations/` | OneDrive settings |
| `/api/health/` | Health check |
| `ws://…/ws/notifications/`, `ws://…/ws/records/<id>/presence/` | Real-time notifications and record presence |

---

## 7. Background jobs

| Job | Schedule | Purpose |
|---|---|---|
| `scan_retention_due` | Daily 02:00 | Flag records due for disposition review |
| `execute_approved_destructions` | Daily 03:00 | Carry out approved destruction certificates that have not run (queue was down, or a hold was lifted) |
| `execute_destruction_certificate` | On approval | Erase the records on one approved certificate and produce its PDF |
| `run_scheduled_backup` | Hourly at :05 | Start a backup if the administrator's schedule says one is due |
| `process_record_ocr` | On upload | OCR, text extraction, vision fallback |
| `update_record_search_vector` | On change | Refresh full-text index |
| `generate_qr_code` | On create | QR code for the physical file |
| `check_duplicate_on_upload` | On upload | Content-hash duplicate warning |
| `process_attachment_text` | On attach | Extract searchable text from attachments |
| `ai_tag_record` / AI analysis | On upload (if AI enabled) | Suggest metadata |
| Embedding jobs | On upload / change | Index passages for semantic search |

Management commands: `verify_audit_chain`, `seed_system`, `scan_retention`, `index_attachments`, `embed_records`, `ai_backfill`, `decrypt_backup`.

---

## 8. Project structure

```
psc-drfms/
├── backend/
│   ├── apps/
│   │   ├── accounts/        users, roles, departments, 2FA, delegation
│   │   ├── records/         records, series, versions, attachments, drive, bin, templates, rules, metadata
│   │   ├── workflows/       templates, instances, actions, cryptographic proofs
│   │   ├── collaboration/   comments, review rounds, assignments, presence (WebSocket)
│   │   ├── sharing/         public share links and access log
│   │   ├── compliance/      legal holds, retention, disposition, destruction certificates
│   │   ├── correspondence/  correspondence register
│   │   ├── search/          full-text, advanced, semantic (pgvector) search
│   │   ├── ai/              LLM gateway, Q&A, analysis, sensitive-content detection, vision
│   │   ├── audit/           audit log, chain of custody, middleware
│   │   ├── notifications/   inbox and real-time delivery
│   │   ├── analytics/       dashboards and reports
│   │   ├── backups/         SMB backups, encryption, restore guide
│   │   ├── onlyoffice/      editor integration
│   │   ├── api_management/  API keys, webhooks, health
│   │   └── core/            appearance, OneDrive settings, shared middleware
│   ├── config/              settings, URLs, ASGI/WSGI
│   ├── tests/               automated tests
│   ├── celery_app.py
│   └── seed_samples/        sample files for seeding
├── frontend/
│   ├── src/
│   │   ├── pages/           route-level screens
│   │   ├── components/      drive, record, layout, shared and UI components
│   │   ├── context/         auth, theme, notifications, transfers, drive UI state
│   │   ├── hooks/           data and keyboard hooks
│   │   ├── locales/         en, fr, bi translations
│   │   └── router/          routes and role guards
│   └── nginx.conf           web server and reverse-proxy config
├── scripts/                 start-dev.ps1, seed-system.ps1, copy-seed-files.sh
├── docker-compose.yml
└── .env.example
```

---

## 9. Testing

Backend tests live in `backend/tests/` and cover authentication, authorisation, records, drive, tags, recycle bin, attachments, search, semantic search, Gemini, AI, workflows, compliance, audit trail, backups, appearance and dashboard activity.

```bash
docker compose exec backend python manage.py test tests
```

Frontend type check and build:

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

---

## 10. Operations notes

- **Data stores to protect:** the `postgres_data` and `minio_data` volumes; enable [backups](#419-backups) and practise a restore.
- **Privacy of AI:** with `LLM_PROVIDER=anthropic` or `gemini`, text from records at or below the configured ceiling is sent to that vendor. Choose the ceiling to match your data-handling policy, or use `ollama` to keep everything on your own servers.
- **First OnlyOffice start** can take two minutes or more; the health check allows for it.
- **Email** uses SMTP settings from the environment; use a console backend in development.
- **Production checklist:** change every default secret and password, set `DEBUG=False`, restrict `ALLOWED_HOSTS`, serve over HTTPS, and run `collectstatic` and migrations as part of deployment.
- **The bundled `docker-compose.yml` is a development setup:** development settings, `DEBUG=True`, auto-reload, published database/Redis/MinIO ports, default credentials. There is no production settings module yet.

---

## 11. Known gaps and roadmap

Found in a code review against records-management and security standards (ISO 15489, MoReq2010, OWASP ASVS, WCAG 2.2). They are listed here so the documented features above are not mistaken for finished controls.

**Records management**
- Destruction: vital records cannot be destroyed at all (no extra-approval path yet); the requester's access to each record is not re-checked; backups made before destruction are not purged.
- Audit log: the chain is checked on demand (no scheduled check, external anchor or external log sink yet), and entries are written explicitly per view rather than captured centrally. Writes are serialised by a database lock, which is fine at this scale but is a throughput limit.
- Retention is a number of years plus a note; event-based triggers, schedule versioning and a controlled "declare as record" lock are not implemented.
- No scheduled fixity (checksum) sweep; integrity is checked only on demand per version.

**Security and operations**
- Production settings, secret/default checks, upload validation and malware scanning, and CI are not yet in place.
- Access and refresh tokens are kept in browser `localStorage`; WebSocket tokens travel in the query string.
- Client IP handling behind nginx can be spoofed, which affects audit IPs and throttling.
- Administrators can read up to Secret with no separate "system administrator" role.

**Declared but not implemented:** digital signatures (`pyhanko`), SAML single sign-on, email-to-record (IMAP), and the `django-haystack` and `django-ratelimit` packages are installed or configured but unused.

**Interface:** translations and an accessibility audit are incomplete; there are no frontend tests.
