from django.db import models


class SavedSearch(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='saved_searches')
    name = models.CharField(max_length=200)
    query = models.CharField(max_length=500)
    filters = models.JSONField(default=dict)
    alert_on_new = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [['user', 'name']]
