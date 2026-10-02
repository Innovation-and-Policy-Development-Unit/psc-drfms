"""
Gemini embedding provider and the classification ceiling that protects
sensitive records from being sent to an outside service.

Run:  python manage.py test tests.test_gemini --settings=config.settings.development
"""
import io
import urllib.error
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.models import Record
from apps.search import embeddings
from apps.search.embeddings import EmbeddingUnavailable
from apps.search.indexing import index_record, may_send_externally
from apps.search.models import RecordChunk
from tests.test_semantic import fake_embed_texts

GEMINI = dict(EMBEDDING_PROVIDER='gemini', GEMINI_API_KEY='test-key', SEMANTIC_SEARCH_ENABLED=True)


def gemini_response(n, dims=1024):
    """n vectors whose first two values are 3 and 4, so their length is 5 before normalising."""
    return {'embeddings': [{'values': [3.0, 4.0] + [0.0] * (dims - 2)} for _ in range(n)]}


@override_settings(**GEMINI)
class GeminiClientTests(TestCase):
    def setUp(self):
        cache.clear()

    @patch('apps.search.embeddings._post_json')
    def test_request_shape_and_normalisation(self, post):
        post.return_value = gemini_response(2)
        vectors = embeddings.embed_texts(['alpha', 'beta'])
        url, payload = post.call_args.args[0], post.call_args.args[1]
        headers = post.call_args.kwargs['headers']

        self.assertIn('gemini-embedding-001:batchEmbedContents', url)
        self.assertNotIn('test-key', url)               # key travels in a header, not the URL
        self.assertEqual(headers, {'x-goog-api-key': 'test-key'})
        self.assertEqual(len(payload['requests']), 2)
        first = payload['requests'][0]
        self.assertEqual(first['taskType'], 'RETRIEVAL_DOCUMENT')
        self.assertEqual(first['outputDimensionality'], 1024)
        self.assertEqual(first['content']['parts'][0]['text'], 'alpha')
        self.assertAlmostEqual(vectors[0][0], 0.6)      # normalised to unit length
        self.assertAlmostEqual(vectors[0][1], 0.8)

    @patch('apps.search.embeddings._post_json')
    def test_queries_use_query_task_type(self, post):
        post.return_value = gemini_response(1)
        embeddings.embed_texts(['what is the leave policy'], kind='query')
        self.assertEqual(post.call_args.args[1]['requests'][0]['taskType'], 'RETRIEVAL_QUERY')

    @patch('apps.search.embeddings._post_json')
    def test_large_inputs_are_batched(self, post):
        post.side_effect = lambda url, payload, *a, **k: gemini_response(len(payload['requests']))
        vectors = embeddings.embed_texts([f't{i}' for i in range(150)])
        self.assertEqual((len(vectors), post.call_count), (150, 2))

    @override_settings(GEMINI_API_KEY='')
    def test_missing_key_is_unavailable_without_a_network_call(self):
        with patch('apps.search.embeddings._post_json') as post:
            with self.assertRaises(EmbeddingUnavailable):
                embeddings.embed_texts(['x'])
            post.assert_not_called()

    def test_rate_limit_maps_to_unavailable(self):
        err = urllib.error.HTTPError('u', 429, 'Too Many Requests', {}, io.BytesIO(b''))
        with patch('apps.search.embeddings._post_json', side_effect=err):
            with self.assertRaisesRegex(EmbeddingUnavailable, 'rate limit'):
                embeddings.embed_texts(['x'])

    def test_network_failure_maps_to_unavailable(self):
        with patch('apps.search.embeddings._post_json', side_effect=urllib.error.URLError('offline')):
            with self.assertRaises(EmbeddingUnavailable):
                embeddings.embed_texts(['x'])

    @patch('apps.search.embeddings._post_json')
    def test_wrong_dimensions_rejected(self, post):
        post.return_value = gemini_response(1, dims=768)
        with self.assertRaisesRegex(EmbeddingUnavailable, 'dimensions'):
            embeddings.embed_texts(['x'])

    @patch('apps.search.embeddings._post_json')
    def test_embed_query_returns_none_when_down_and_caches_success(self, post):
        post.side_effect = urllib.error.URLError('offline')
        self.assertIsNone(embeddings.embed_query('anything'))
        post.side_effect = None
        post.return_value = gemini_response(1)
        embeddings.embed_query('same words')
        embeddings.embed_query('same words')
        self.assertEqual(post.call_count, 2)  # one failed call + one success; the repeat hit the cache

    def test_status_reports_external_provider_and_ceiling(self):
        status = embeddings.service_status()
        self.assertEqual((status['provider'], status['external'], status['available']), ('gemini', True, True))
        self.assertEqual(status['maxClassification'], 'internal')

    @override_settings(GEMINI_API_KEY='')
    def test_status_unavailable_without_key(self):
        cache.clear()
        self.assertFalse(embeddings.service_status()['available'])


@patch('apps.search.embeddings.embed_texts', side_effect=fake_embed_texts)
class ClassificationCeilingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            email='a@t.gov.vu', username='a', first_name='A', last_name='B',
            password='Secur3Pass!', role=UserRole.ADMINISTRATOR,
        )

    def _record(self, level, title='Pay review'):
        return Record.objects.create(title=title, classification_level=level, custodian=self.admin, author=self.admin)

    @override_settings(**GEMINI)
    def test_default_ceiling_is_internal(self, mock):
        sent = {lvl: bool(index_record(self._record(lvl, f'r-{lvl}').pk)) for lvl in
                ('unclassified', 'internal', 'confidential', 'restricted', 'secret')}
        self.assertEqual(sent, {
            'unclassified': True, 'internal': True, 'confidential': False, 'restricted': False, 'secret': False,
        })

    @override_settings(**GEMINI, EMBEDDING_EXTERNAL_MAX_CLASSIFICATION='confidential')
    def test_ceiling_can_be_raised(self, mock):
        self.assertTrue(index_record(self._record('confidential').pk))
        self.assertFalse(index_record(self._record('restricted', 'other').pk))

    @override_settings(**GEMINI, EMBEDDING_EXTERNAL_MAX_CLASSIFICATION='nonsense')
    def test_unknown_ceiling_is_strictest(self, mock):
        self.assertFalse(may_send_externally(self._record('internal')))
        self.assertTrue(may_send_externally(self._record('unclassified', 'other')))

    @override_settings(**GEMINI)
    def test_nothing_is_sent_for_a_record_above_the_ceiling(self, mock):
        index_record(self._record('secret').pk)
        mock.assert_not_called()

    @override_settings(**GEMINI)
    def test_reclassifying_upwards_removes_existing_vectors(self, mock):
        rec = self._record('internal')
        index_record(rec.pk)
        self.assertTrue(RecordChunk.objects.filter(record=rec).exists())
        Record.objects.filter(pk=rec.pk).update(classification_level='secret')
        index_record(rec.pk)
        self.assertFalse(RecordChunk.objects.filter(record=rec).exists())

    @override_settings(EMBEDDING_PROVIDER='ollama', SEMANTIC_SEARCH_ENABLED=True)
    def test_local_provider_has_no_ceiling(self, mock):
        self.assertTrue(index_record(self._record('secret').pk))

    @override_settings(**GEMINI)
    def test_search_says_when_the_query_went_outside(self, mock):
        client = APIClient()
        client.force_authenticate(self.admin)
        self.assertTrue(client.get('/api/search/', {'q': 'pay'}).json()['meaningExternal'])
        self.assertFalse(client.get('/api/search/', {'q': 'pay', 'mode': 'keyword'}).json()['meaningExternal'])
