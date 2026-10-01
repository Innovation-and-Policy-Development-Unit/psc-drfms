# Load the Celery app when Django starts so `shared_task.delay()` called from
# web requests uses the configured broker (without this it falls back to
# amqp://localhost and every upload returns a 500).
from celery_app import app as celery_app

__all__ = ('celery_app',)
