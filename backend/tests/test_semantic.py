"""
Semantic (meaning-based) search tests. A deterministic fake embedder stands in
for Ollama so these run anywhere; it maps synonyms onto the same dimensions.

Run:  python manage.py test tests.test_semantic --settings=config.settings.development
"""
import hashlib
import math
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.models import DocumentPermission, Record, RecordVersion
from apps.records.tasks import update_record_search_vector
from apps.search import embeddings
from apps.search.chunking import split_text
from apps.search.embeddings import EmbeddingUnavailable
from apps.search.indexing import index_record
from apps.search.models import RecordChunk

CANON = {
    'salary': 'pay', 'wages': 'pay', 'remuneration': 'pay', 'payment': 'pay',
    'grievances': 'dispute', 'complaints': 'dispute', 'disputes': 'dispute',
}


def fake_vector(text):
    vec = [0.0] * 1024
    for word in text.lower().replace('.', ' ').replace(',', ' ').split():
        canon = CANON.get(word, word)
        vec[int(hashlib.md5(canon.encode()).hexdigest(), 16) % 1024] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def fake_embed_texts(texts, kind='document'):
    return [fake_vector(t) for t in texts]


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def make_record(owner, title, text='', **kwargs):
    rec = Record.objects.create(title=title, custodian=owner, author=owner, **kwargs)
    if text:
        RecordVersion.objects.create(
            record=rec, version_number=1, file=f'x/{rec.pk}.txt', file_name='x.txt',
            file_size=len(text), mime_type='text/plain', content_hash=str(rec.pk),
            ocr_text=text, ocr_processed=True, created_by=owner,
        )
    update_record_search_vector(str(rec.pk))
    index_record(rec.pk)
    return rec


class ChunkingTests(TestCase):
    def test_short_text_is_one_chunk(self):
        self.assertEqual(split_text('One short paragraph.'), ['One short paragraph.'])

    def test_long_text_is_split_with_overlap_and_capped(self):
        text = '\n\n'.join(f'Paragraph {i}. ' + 'word ' * 60 for i in range(80))
        chunks = split_text(text)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= 1100 for c in chunks))
        self.assertLessEqual(len(chunks), 80)

    def test_empty(self):
        self.assertEqual(split_text('  \n '), [])


# Pinned to the local provider: these tests exercise ranking and permissions,
# including secret records, which an external provider would never receive.
@override_settings(SEMANTIC_MIN_SIMILARITY=0.3, SEMANTIC_SEARCH_ENABLED=True, EMBEDDING_PROVIDER='ollama')
@patch('apps.search.embeddings.embed_texts', side_effect=fake_embed_texts)
class SemanticSearchTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def _build(self, mock):
        self.pay = make_record(
            self.admin, 'Remuneration review',
            'Employees raised salary grievances about late payment of allowances.',
            classification_level='internal',
        )
        self.furniture = make_record(
            self.admin, 'Office furniture contract', 'Supply of desks and chairs.',
            classification_level='internal',
        )

    def test_index_creates_header_and_body_chunks(self, mock):
        self._build(mock)
        chunks = list(RecordChunk.objects.filter(record=self.pay).order_by('chunk_index'))
        self.assertEqual([c.chunk_index for c in chunks], [0, 1])
        self.assertTrue(chunks[0].text.startswith('Remuneration review'))

    def test_reindex_reuses_unchanged_passages(self, mock):
        self._build(mock)
        mock.reset_mock()
        index_record(self.pay.pk)
        mock.assert_not_called()  # nothing changed, nothing re-embedded
        Record.objects.filter(pk=self.pay.pk).update(title='Pay review')
        index_record(self.pay.pk)
        self.assertEqual(sum(len(c.args[0]) for c in mock.call_args_list), 1)  # header only

    def test_finds_by_meaning_without_shared_words(self, mock):
        self._build(mock)
        data = self.client.get('/api/search/', {'q': 'wages complaints'}).json()
        self.assertEqual([r['title'] for r in data['results']], ['Remuneration review'])
        self.assertEqual(data['results'][0]['matchedBy'], 'meaning')
        self.assertEqual(data['meaningMatches'], 1)

    def test_keyword_mode_skips_meaning(self, mock):
        self._build(mock)
        data = self.client.get('/api/search/', {'q': 'wages complaints', 'mode': 'keyword'}).json()
        self.assertEqual(data['count'], 0)

    def test_word_match_is_labelled_keyword_or_both(self, mock):
        self._build(mock)
        data = self.client.get('/api/search/', {'q': 'furniture'}).json()
        self.assertEqual(data['results'][0]['title'], 'Office furniture contract')
        self.assertIn(data['results'][0]['matchedBy'], ('keyword', 'both'))

    def test_meaning_matches_respect_classification(self, mock):
        secret = make_record(
            self.admin, 'Confidential pay settlement',
            'Salary grievances were settled in private.', classification_level='secret',
        )
        reader = APIClient()
        reader.force_authenticate(self.reader)
        data = reader.get('/api/search/', {'q': 'wages complaints'}).json()
        self.assertNotIn(str(secret.pk), [r['id'] for r in data['results']])
        admin_ids = [r['id'] for r in self.client.get('/api/search/', {'q': 'wages complaints'}).json()['results']]
        self.assertIn(str(secret.pk), admin_ids)

    def test_results_not_duplicated_by_permission_join(self, mock):
        self._build(mock)
        other_a = make_user('a@t.gov.vu', UserRole.REVIEWER)
        other_b = make_user('b@t.gov.vu', UserRole.REVIEWER)
        for u in (other_a, other_b):
            DocumentPermission.objects.create(record=self.pay, user=u, granted_by=self.admin)
        reader = APIClient()
        reader.force_authenticate(self.reader)
        data = reader.get('/api/search/', {'q': 'remuneration'}).json()
        self.assertEqual([r['id'] for r in data['results']].count(str(self.pay.pk)), 1)
        self.assertEqual(data['count'], 1)

    def test_falls_back_to_keywords_when_embedding_service_down(self, mock):
        self._build(mock)
        mock.side_effect = EmbeddingUnavailable('down')
        embeddings.cache.clear()
        data = self.client.get('/api/search/', {'q': 'remuneration'}).json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['meaningMatches'], 0)

    def test_similar_records(self, mock):
        self._build(mock)
        twin = make_record(
            self.admin, 'Staff wages complaints log',
            'Complaints and disputes about wages and salary.', classification_level='internal',
        )
        data = self.client.get(f'/api/search/similar/{self.pay.pk}/').json()
        ids = [r['id'] for r in data['results']]
        self.assertTrue(data['indexed'])
        self.assertIn(str(twin.pk), ids)
        self.assertNotIn(str(self.pay.pk), ids)
        self.assertNotIn(str(self.furniture.pk), ids)

    def test_similar_requires_view_access(self, mock):
        secret = make_record(self.admin, 'Secret pay file', 'Salary grievances.', classification_level='secret')
        reader = APIClient()
        reader.force_authenticate(self.reader)
        self.assertEqual(reader.get(f'/api/search/similar/{secret.pk}/').status_code, 403)

    def test_similar_for_unindexed_record(self, mock):
        rec = Record.objects.create(title='Not indexed yet', custodian=self.admin, author=self.admin)
        data = self.client.get(f'/api/search/similar/{rec.pk}/').json()
        self.assertEqual((data['indexed'], data['results']), (False, []))

    def test_status_endpoint(self, mock):
        self._build(mock)
        with patch('apps.search.views.service_status', return_value={'enabled': True, 'available': True, 'model': 'bge-m3'}):
            data = self.client.get('/api/search/semantic-status/').json()
        self.assertEqual((data['available'], data['indexedRecords'], data['totalRecords']), (True, 2, 2))
