import django.db.models.deletion
import pgvector.django
from django.db import migrations, models
from pgvector.django import VectorExtension


class Migration(migrations.Migration):
    """Semantic search: pgvector extension and the RecordChunk embedding table."""

    dependencies = [
        ('records', '0004_trigram_search'),
        ('search', '0001_initial'),
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name='RecordChunk',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chunk_index', models.PositiveIntegerField()),
                ('text', models.TextField()),
                ('text_hash', models.CharField(max_length=64)),
                ('embedding', pgvector.django.VectorField(dimensions=1024)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chunks', to='records.record')),
            ],
            options={
                'ordering': ['record_id', 'chunk_index'],
            },
        ),
        migrations.AddConstraint(
            model_name='recordchunk',
            constraint=models.UniqueConstraint(fields=('record', 'chunk_index'), name='uniq_record_chunk_index'),
        ),
        migrations.AddIndex(
            model_name='recordchunk',
            index=pgvector.django.HnswIndex(
                ef_construction=64, fields=['embedding'], m=16,
                name='chunk_embedding_hnsw', opclasses=['vector_cosine_ops'],
            ),
        ),
    ]
