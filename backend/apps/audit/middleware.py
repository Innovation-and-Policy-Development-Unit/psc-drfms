from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class AuditMiddleware(MiddlewareMixin):
    """Passthrough — actual logging is done explicitly in views."""

    def process_response(self, request, response):
        return response
