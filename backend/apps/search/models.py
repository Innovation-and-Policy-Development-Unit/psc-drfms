from django.db import models


class NoResultSearch(models.Model):
    query = models.CharField(max_length=500, unique=True)
    count = models.PositiveIntegerField(default=1)
    last_searched = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-count']

    def __str__(self):
        return f'"{self.query}" ({self.count} times)'
