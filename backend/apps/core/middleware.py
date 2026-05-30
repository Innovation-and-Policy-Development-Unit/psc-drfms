import logging
import time

from django.conf import settings
from django.db import connection, reset_queries

logger = logging.getLogger('apps.db')


class QueryCountMiddleware:
    """Log slow requests and high query counts in development."""

    SLOW_MS = 500
    QUERY_WARN = 20

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not settings.DEBUG:
            return self.get_response(request)

        reset_queries()
        start = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        query_count = len(connection.queries)

        if query_count >= self.QUERY_WARN or elapsed_ms >= self.SLOW_MS:
            logger.warning(
                '%s %s — %d queries in %.0fms',
                request.method,
                request.path,
                query_count,
                elapsed_ms,
            )
        else:
            logger.debug(
                '%s %s — %d queries in %.0fms',
                request.method,
                request.path,
                query_count,
                elapsed_ms,
            )
        return response
