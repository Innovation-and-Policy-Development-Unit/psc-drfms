from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1']),
    SAML_ENABLED=(bool, False),
)
environ.Env.read_env(BASE_DIR.parent / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'django_otp',
    'django_otp.plugins.otp_totp',
    'django_otp.plugins.otp_email',
    'django_celery_beat',
    'django_celery_results',
    'drf_spectacular',
    'django_filters',
    'storages',
]

LOCAL_APPS = [
    'apps.core',
    'apps.accounts',
    'apps.records',
    'apps.workflows',
    'apps.correspondence',
    'apps.audit',
    'apps.notifications',
    'apps.search',
    'apps.ai',
    'apps.compliance',
    'apps.collaboration',
    'apps.analytics',
    'apps.sharing',
    'apps.api_management',
    'apps.onlyoffice',
    'apps.backups',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django_otp.middleware.OTPMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database
DATABASES = {
    'default': env.db('DATABASE_URL', default='postgresql://psc_user:psc_secure_password@db:5432/psc_drfms')
}
DATABASES['default']['OPTIONS'] = {'connect_timeout': 10}

# Redis / Channels
REDIS_URL = env('REDIS_URL', default='redis://redis:6379/0')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    }
}

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# Custom user model
AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en'
TIME_ZONE = 'Pacific/Efate'
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ('en', 'English'),
    ('fr', 'French'),
]

LOCALE_PATHS = [BASE_DIR / 'locale']

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media (local filesystem; MinIO settings below are available if you switch storage)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# MinIO / S3 Storage
MINIO_ENDPOINT = env('MINIO_ENDPOINT', default='minio:9000')
MINIO_ACCESS_KEY = env('MINIO_ACCESS_KEY', default='minioadmin')
MINIO_SECRET_KEY = env('MINIO_SECRET_KEY', default='minioadmin123')
MINIO_BUCKET_NAME = env('MINIO_BUCKET_NAME', default='psc-drfms-documents')
MINIO_USE_HTTPS = env.bool('MINIO_USE_HTTPS', default=False)

AWS_S3_ENDPOINT_URL = f"{'https' if MINIO_USE_HTTPS else 'http'}://{MINIO_ENDPOINT}"
AWS_ACCESS_KEY_ID = MINIO_ACCESS_KEY
AWS_SECRET_ACCESS_KEY = MINIO_SECRET_KEY
AWS_STORAGE_BUCKET_NAME = MINIO_BUCKET_NAME
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None
AWS_S3_VERIFY = False
AWS_QUERYSTRING_AUTH = True
AWS_QUERYSTRING_EXPIRE = 3600

DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'apps.api_management.authentication.ApiKeyAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': [
        'djangorestframework_camel_case.render.CamelCaseJSONRenderer',
        'djangorestframework_camel_case.render.CamelCaseBrowsableAPIRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'djangorestframework_camel_case.parser.CamelCaseJSONParser',
        'djangorestframework_camel_case.parser.CamelCaseFormParser',
        'djangorestframework_camel_case.parser.CamelCaseMultiPartParser',
    ],
    'JSON_UNDERSCOREIZE': {
        'no_underscore_before_number': True,
    },
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/min',
        'user': '300/min',
    },
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# API documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'PSC-DRFMS API',
    'DESCRIPTION': 'PSC Digital Records & File Management System — Enterprise DMS API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Celery
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 1800
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Scheduled jobs — DatabaseScheduler installs these into django_celery_beat
# on beat startup; they remain editable in the admin afterwards.
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    'retention-disposition-scan': {
        'task': 'apps.compliance.tasks.scan_retention_due',
        'schedule': crontab(hour=2, minute=0),
    },
    # Checks the administrator's backup schedule hourly; starts a run only when it is due.
    'backup-schedule-check': {
        'task': 'apps.backups.tasks.run_scheduled_backup',
        'schedule': crontab(minute=5),
    },
}

# Backups: longest a single backup may run, and the longest a database dump may take
BACKUP_TIME_LIMIT_HOURS = env.float('BACKUP_TIME_LIMIT_HOURS', default=12)
BACKUP_DUMP_TIMEOUT = env.int('BACKUP_DUMP_TIMEOUT', default=3 * 3600)

# Email — console backend until a real SMTP host is configured, so sends
# never raise; switch via EMAIL_BACKEND env once SMTP credentials exist
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='PSC-DRFMS <noreply@psc.gov.vu>')
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# IMAP (email-to-record)
IMAP_HOST = env('IMAP_HOST', default='')
IMAP_PORT = env.int('IMAP_PORT', default=993)
IMAP_USER = env('IMAP_USER', default='')
IMAP_PASSWORD = env('IMAP_PASSWORD', default='')
IMAP_MAILBOX = env('IMAP_MAILBOX', default='INBOX')

# 2FA
OTP_TOTP_ISSUER = env('OTP_TOTP_ISSUER', default='PSC-DRFMS')

# SAML / SSO
SAML_ENABLED = env.bool('SAML_ENABLED', default=False)
SAML_SP_ENTITY_ID = env('SAML_SP_ENTITY_ID', default='')
SAML_IDP_METADATA_URL = env('SAML_IDP_METADATA_URL', default='')

# Semantic search: turns passages and queries into vectors.
#   EMBEDDING_PROVIDER = 'gemini'  Google Gemini API (free tier). Text is SENT TO GOOGLE.
#                      = 'ollama'  a local Ollama server; text never leaves the deployment.
# Whatever the model, its output size must equal EMBEDDING_DIMENSIONS, which is also
# the width of the RecordChunk.embedding column.
EMBEDDING_PROVIDER = env('EMBEDDING_PROVIDER', default='gemini')
EMBEDDING_DIMENSIONS = 1024
SEMANTIC_SEARCH_ENABLED = env.bool('SEMANTIC_SEARCH_ENABLED', default=True)
# Minimum cosine similarity (0-1) for a passage to count as a meaning match.
# Tune per model: raise it if unrelated records show up, lower it if related ones are missed.
SEMANTIC_MIN_SIMILARITY = env.float('SEMANTIC_MIN_SIMILARITY', default=0.55)

# Google Gemini (key goes in .env, never in code)
GEMINI_API_KEY = env('GEMINI_API_KEY', default='')
GEMINI_EMBED_MODEL = env('GEMINI_EMBED_MODEL', default='gemini-embedding-001')
GEMINI_TIMEOUT = env.int('GEMINI_TIMEOUT', default=30)
# Safety rail for external providers: only records at or below this classification
# are ever sent out. Higher ones stay keyword-searchable only.
# One of: unclassified, internal, confidential, restricted, secret
EMBEDDING_EXTERNAL_MAX_CLASSIFICATION = env('EMBEDDING_EXTERNAL_MAX_CLASSIFICATION', default='internal')

# Local Ollama (only used when EMBEDDING_PROVIDER=ollama)
OLLAMA_URL = env('OLLAMA_URL', default='http://ollama:11434')
OLLAMA_EMBED_MODEL = env('OLLAMA_EMBED_MODEL', default='bge-m3')
OLLAMA_TIMEOUT = env.int('OLLAMA_TIMEOUT', default=60)

# Generative AI (Q&A, summaries, extraction, retention and sensitivity suggestions).
#   LLM_PROVIDER       = 'none' (default: AI features off), 'anthropic', 'gemini' or 'ollama'
#   LLM_LOCAL_PROVIDER = 'none' or 'ollama': used for records ABOVE LLM_EXTERNAL_MAX_CLASSIFICATION
# Hybrid setup: LLM_PROVIDER=anthropic + LLM_LOCAL_PROVIDER=ollama. Records at or below the
# ceiling go to the cloud model, everything above stays on your server. With no local
# provider, records above the ceiling simply get no AI. Keys go in .env, never in code.
LLM_PROVIDER = env('LLM_PROVIDER', default='none')
LLM_LOCAL_PROVIDER = env('LLM_LOCAL_PROVIDER', default='none')
LLM_EXTERNAL_MAX_CLASSIFICATION = env('LLM_EXTERNAL_MAX_CLASSIFICATION', default='internal')
LLM_TIMEOUT = env.int('LLM_TIMEOUT', default=90)
LLM_MAX_CONTEXT_CHARS = env.int('LLM_MAX_CONTEXT_CHARS', default=24000)
LLM_RATE_LIMIT_PER_MINUTE = env.int('LLM_RATE_LIMIT_PER_MINUTE', default=20)
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')
ANTHROPIC_MODEL = env('ANTHROPIC_MODEL', default='claude-sonnet-5-5')
GEMINI_LLM_MODEL = env('GEMINI_LLM_MODEL', default='gemini-2.5-flash')
OLLAMA_LLM_MODEL = env('OLLAMA_LLM_MODEL', default='llama3.1')
OLLAMA_VISION_MODEL = env('OLLAMA_VISION_MODEL', default='')  # e.g. llava; empty = no vision on Ollama
# Fill blank metadata automatically when the model is at least this sure (0 disables).
# Only empty fields are ever filled; classification is never changed automatically.
AI_AUTOFILE_CONFIDENCE = env.float('AI_AUTOFILE_CONFIDENCE', default=0.0)
# Scanned pages Tesseract could not read are transcribed by a vision model.
AI_VISION_OCR_ENABLED = env.bool('AI_VISION_OCR_ENABLED', default=True)
AI_VISION_OCR_MAX_PAGES = env.int('AI_VISION_OCR_MAX_PAGES', default=10)

# Session
SESSION_COOKIE_AGE = env.int('SESSION_COOKIE_AGE', default=28800)
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# CORS
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=['http://localhost:3000'])

# OCR
TESSERACT_PATH = '/usr/bin/tesseract'
OCR_LANGUAGES = env('OCR_LANGUAGES', default='eng+fra')

# QR Codes
QR_CODE_BASE_URL = env('QR_CODE_BASE_URL', default='http://localhost:3000')

# Audit
AUDIT_LOG_EXCLUDED_PATHS = ['/api/health/', '/static/', '/media/']

# Compliance
DEFAULT_RETENTION_YEARS = 7
LEGAL_HOLD_NOTIFICATION_DAYS_BEFORE = 30

# OnlyOffice Document Server
ONLYOFFICE_JWT_SECRET = env('ONLYOFFICE_JWT_SECRET', default='psc_drfms_oo_secret_change_in_prod')
# Internal Docker hostname backend uses when building callback/document URLs for OnlyOffice
ONLYOFFICE_BACKEND_INTERNAL_URL = env('ONLYOFFICE_BACKEND_INTERNAL_URL', default='http://backend:8000')
# Browser-accessible URL of the OnlyOffice server (used to load the JS SDK)
ONLYOFFICE_PUBLIC_URL = env('ONLYOFFICE_PUBLIC_URL', default='http://localhost:8082')
