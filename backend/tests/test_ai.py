"""
AI feature tests. The language model is always faked: these check the guarantees
around it (classification gate, permissions, validation, "AI never acts alone").

Run:  python manage.py test tests.test_ai --settings=config.settings.development
"""
import json
from datetime import date
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.ai import llm
from apps.ai.analysis import analyze, apply_autofile, review_status
from apps.ai.models import AiCallLog
from apps.ai.sensitive import detect_sensitive
from apps.records.models import Record, RecordSeries, RecordVersion

CLOUD = dict(LLM_PROVIDER='anthropic', ANTHROPIC_API_KEY='test-key', LLM_LOCAL_PROVIDER='none',
             LLM_EXTERNAL_MAX_CLASSIFICATION='internal')


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
    return rec


class ClassificationGateTests(TestCase):
    @override_settings(**CLOUD)
    def test_cloud_only_reads_up_to_the_ceiling(self):
        self.assertEqual(llm.provider_for('unclassified').name, 'anthropic')
        self.assertEqual(llm.provider_for('internal').name, 'anthropic')
        self.assertIsNone(llm.provider_for('confidential'))
        self.assertIsNone(llm.provider_for('secret'))
        self.assertIsNone(llm.provider_for('something-unknown'))

    @override_settings(**{**CLOUD, 'LLM_LOCAL_PROVIDER': 'ollama'})
    def test_hybrid_sends_higher_classifications_to_the_local_model(self):
        self.assertEqual(llm.provider_for('internal').name, 'anthropic')
        self.assertEqual(llm.provider_for('restricted').name, 'ollama')
        self.assertEqual(llm.provider_for_levels(['internal', 'secret']).name, 'ollama')

    @override_settings(LLM_PROVIDER='none', LLM_LOCAL_PROVIDER='none')
    def test_off_by_default(self):
        self.assertFalse(llm.is_enabled())
        self.assertIsNone(llm.provider_for('unclassified'))

    @override_settings(LLM_PROVIDER='anthropic', ANTHROPIC_API_KEY='')
    def test_missing_key_means_off(self):
        self.assertFalse(llm.is_enabled())

    def test_parse_json_tolerates_fences_and_chatter(self):
        self.assertEqual(llm.parse_json('```json\n{"a": 1}\n```'), {'a': 1})
        self.assertEqual(llm.parse_json('Sure! {"a": 1} hope that helps'), {'a': 1})
        with self.assertRaises(llm.LLMUnavailable):
            llm.parse_json('no json here')


class SensitiveDetectionTests(TestCase):
    def test_flags_card_number_but_not_random_digits(self):
        flags = {f['category']: f for f in detect_sensitive('Card 4111 1111 1111 1111 expires soon. Ref 1234567890123.')}
        self.assertIn('financial_account', flags)
        self.assertEqual(flags['financial_account']['count'], 1)
        self.assertTrue(flags['financial_account']['example'].endswith('1111'))
        self.assertNotIn('4111', flags['financial_account']['example'])  # masked

    def test_flags_medical_and_disciplinary(self):
        cats = {f['category'] for f in detect_sensitive('Following the disciplinary hearing, a medical certificate was filed.')}
        self.assertEqual(cats, {'medical', 'disciplinary'})

    def test_plain_letter_is_clean(self):
        self.assertEqual(detect_sensitive('Dear Sir, please find attached the annual report. Yours faithfully.'), [])


@override_settings(**CLOUD)
class AnalysisTests(TestCase):
    def setUp(self):
        self.owner = make_user('o@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.series = RecordSeries.objects.create(code='HR-01', name='Personnel files', retention_years=10)
        self.record = make_record(self.owner, 'Untitled scan', 'Leave application for the employee. Outcome of the disciplinary hearing attached.')
        self.version = self.record.versions.first()

    def _model_answer(self, **over):
        data = {
            'title': 'Leave application', 'document_type': 'personnel_file',
            'originating_ministry': 'Ministry of Finance', 'document_date': '2024-03-05',
            'reference_number': 'PSC/2024/17', 'language': 'English', 'classification_level': 'internal',
            'parties': ['J. Tari'], 'amounts': [{'label': 'Allowance', 'amount': 1500000, 'currency': 'vuv'}],
            'series_code': 'HR-01', 'summary': 'An employee applies for leave.',
            'sensitive': [{'category': 'medical', 'note': 'mentions sick leave'}],
            'confidence': {'document_type': 0.95, 'originating_ministry': 0.9, 'document_date': 0.92, 'series_code': 0.8},
        }
        data.update(over)
        return json.dumps(data)

    def test_model_output_becomes_validated_suggestions(self):
        with patch('apps.ai.llm._anthropic', return_value=self._model_answer()):
            suggestions, summary, engine = analyze(self.version)
        self.assertEqual(suggestions['document_type']['value'], 'personnel_file')
        self.assertEqual(suggestions['originating_ministry']['confidence'], 0.9)
        self.assertEqual(suggestions['amounts']['value'][0]['currency'], 'VUV')
        self.assertEqual(suggestions['record_series']['value'], str(self.series.pk))
        self.assertEqual(suggestions['record_series']['retention_years'], 10)
        self.assertEqual(suggestions['retention_date']['value'], '2034-03-05')
        self.assertIn('sensitive_flags', suggestions)
        self.assertEqual(suggestions['classification_level']['value'], 'confidential')  # raised by the flag
        self.assertEqual(summary, 'An employee applies for leave.')
        self.assertTrue(engine.startswith('anthropic:'))
        self.assertTrue(AiCallLog.objects.filter(feature='analysis', ok=True, external=True).exists())

    def test_invalid_model_values_are_dropped(self):
        bad = self._model_answer(document_type='made_up', document_date='2999-01-01', series_code='NOPE',
                                 classification_level='top_top_secret', sensitive=[{'category': 'bogus'}])
        with patch('apps.ai.llm._anthropic', return_value=bad):
            suggestions, _, _ = analyze(self.version)
        for key in ('document_type', 'document_date', 'record_series'):
            self.assertNotIn(key, suggestions)
        # the invalid level is ignored; only the local sensitivity rule may propose one
        self.assertEqual(suggestions['classification_level']['value'], 'confidential')

    def test_classified_record_is_never_sent_to_the_cloud(self):
        Record.objects.filter(pk=self.record.pk).update(classification_level='confidential')
        self.version.record.refresh_from_db()
        with patch('apps.ai.llm._anthropic') as cloud:
            suggestions, summary, engine = analyze(self.version)
        cloud.assert_not_called()
        self.assertEqual(engine, '')
        self.assertEqual(summary, '')
        self.assertIn('sensitive_flags', suggestions)  # local detection still works

    @override_settings(AI_AUTOFILE_CONFIDENCE=0.9)
    def test_autofill_only_fills_empty_fields_and_never_series_or_classification(self):
        self.record.originating_ministry = 'Ministry of Health'
        self.record.save()
        with patch('apps.ai.llm._anthropic', return_value=self._model_answer()):
            suggestions, _, _ = analyze(self.version)
        filled = apply_autofile(self.record, suggestions)
        self.assertEqual(filled, ['document_date', 'document_type'])
        self.record.refresh_from_db()
        self.assertEqual(self.record.originating_ministry, 'Ministry of Health')  # untouched
        self.assertEqual(self.record.document_date, date(2024, 3, 5))
        self.assertIsNone(self.record.record_series)
        self.assertEqual(self.record.classification_level, 'internal')
        self.assertEqual(review_status(self.record, suggestions, filled), 'needs_review')

    @override_settings(AI_AUTOFILE_CONFIDENCE=0)
    def test_autofill_is_off_by_default(self):
        with patch('apps.ai.llm._anthropic', return_value=self._model_answer()):
            suggestions, _, _ = analyze(self.version)
        self.assertEqual(apply_autofile(self.record, suggestions), [])


@override_settings(**CLOUD)
class AskArchiveTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.public = make_record(self.admin, 'Leave policy 2024', 'Annual leave is 25 days.', classification_level='internal')
        self.secret = make_record(self.admin, 'Secret leave memo', 'Commissioners get 40 days.', classification_level='secret')
        self.client = APIClient()
        self.client.force_authenticate(self.reader)

    def _passages(self, *records):
        return [{'record': r, 'text': r.versions.first().ocr_text, 'similarity': 0.9} for r in records]

    def test_answer_cites_sources_and_unreadable_records_are_not_consulted(self):
        # Retrieval is the permission boundary; if it hands back a secret record the gate still holds
        with patch('apps.ai.qa._semantic_passages', return_value=self._passages(self.public, self.secret)), \
                patch('apps.ai.llm._anthropic', return_value='Annual leave is 25 days [1].') as cloud:
            data = self.client.post('/api/ai/ask/', {'question': 'How many leave days?'}, format='json').json()
        self.assertEqual(data['answer'], 'Annual leave is 25 days [1].')
        self.assertEqual([s['title'] for s in data['sources']], ['Leave policy 2024'])
        self.assertTrue(data['sources'][0]['cited'])
        self.assertEqual(data['excludedRecords'], 1)
        sent = json.dumps(cloud.call_args.args[3])
        self.assertNotIn('Commissioners get 40 days', sent)

    def test_retrieval_is_restricted_to_what_the_user_may_view(self):
        from apps.ai import qa
        with patch('apps.ai.qa.embed_query', return_value=None):
            passages = qa._keyword_passages(self.reader, 'leave days')
        titles = {p['record'].title for p in passages}
        self.assertNotIn('Secret leave memo', titles)

    def test_no_sources_means_no_model_call(self):
        with patch('apps.ai.qa._semantic_passages', return_value=[]), patch('apps.ai.llm._anthropic') as cloud:
            data = self.client.post('/api/ai/ask/', {'question': 'Anything?'}, format='json').json()
        cloud.assert_not_called()
        self.assertEqual(data['sources'], [])

    @override_settings(LLM_PROVIDER='none')
    def test_returns_503_when_ai_is_off(self):
        res = self.client.post('/api/ai/ask/', {'question': 'hi'}, format='json')
        self.assertEqual(res.status_code, 503)

    def test_empty_question_is_rejected(self):
        res = self.client.post('/api/ai/ask/', {'question': '  '}, format='json')
        self.assertEqual(res.status_code, 400)

    @override_settings(LLM_RATE_LIMIT_PER_MINUTE=2)
    def test_rate_limited(self):
        with patch('apps.ai.qa._semantic_passages', return_value=[]):
            codes = [self.client.post('/api/ai/ask/', {'question': 'q'}, format='json').status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])


@override_settings(**CLOUD)
class RecordActionTests(TestCase):
    def setUp(self):
        self.owner = make_user('o@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.series = RecordSeries.objects.create(code='FIN-01', name='Financial statements', retention_years=7)
        self.record = make_record(self.owner, 'Budget', 'The annual budget text.', classification_level='internal',
                                  document_date=date(2024, 2, 29))
        self.client = APIClient()

    def test_chat_needs_view_permission_and_uses_document_text(self):
        secret = make_record(self.owner, 'Hidden', 'secret stuff', classification_level='secret')
        self.client.force_authenticate(self.reader)
        res = self.client.post(f'/api/ai/records/{secret.pk}/chat/', {'messages': [{'role': 'user', 'content': 'hi'}]}, format='json')
        self.assertEqual(res.status_code, 403)
        with patch('apps.ai.llm._anthropic', return_value='It is a budget.') as cloud:
            res = self.client.post(f'/api/ai/records/{self.record.pk}/chat/',
                                   {'messages': [{'role': 'user', 'content': 'What is this?'}]}, format='json')
        self.assertEqual(res.json()['answer'], 'It is a budget.')
        self.assertIn('The annual budget text.', cloud.call_args.args[1])

    def test_chat_refuses_records_above_the_ceiling(self):
        conf = make_record(self.owner, 'Conf', 'conf text', classification_level='confidential')
        self.client.force_authenticate(self.owner)
        with patch('apps.ai.llm._anthropic') as cloud:
            res = self.client.post(f'/api/ai/records/{conf.pk}/chat/', {'messages': [{'role': 'user', 'content': 'hi'}]}, format='json')
        self.assertEqual(res.status_code, 503)
        cloud.assert_not_called()

    def test_apply_retention_is_a_human_action_with_server_side_date(self):
        self.client.force_authenticate(self.reader)
        res = self.client.post(f'/api/ai/records/{self.record.pk}/apply-retention/', {'record_series': self.series.pk}, format='json')
        self.assertEqual(res.status_code, 403)
        self.client.force_authenticate(self.owner)
        res = self.client.post(f'/api/ai/records/{self.record.pk}/apply-retention/',
                               {'record_series': self.series.pk, 'retention_date': '1999-01-01'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.record_series, self.series)
        self.assertEqual(self.record.retention_date, date(2031, 2, 28))  # from series + document date, not the client

    def test_review_queue_lists_only_records_the_user_can_edit(self):
        RecordVersion.objects.filter(record=self.record).update(ai_review_status='needs_review')
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get('/api/ai/review-queue/').json()['count'], 0)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/ai/review-queue/').json()['count'], 1)
        self.client.post(f'/api/ai/records/{self.record.pk}/review/')
        self.assertEqual(self.client.get('/api/ai/review-queue/').json()['count'], 0)


@override_settings(**CLOUD)
class SearchParseTests(TestCase):
    def setUp(self):
        self.officer = make_user('o@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.client = APIClient()
        self.client.force_authenticate(self.officer)

    def test_search_parse_keeps_only_valid_filters(self):
        Record.objects.create(title='C', custodian=self.officer, author=self.officer, originating_ministry='Ministry of Finance')
        answer = json.dumps({
            'q': 'contracts', 'document_type': 'contract', 'ministry': 'Ministry of Nowhere',
            'date_from': '2024-01-01', 'date_to': 'not-a-date', 'classification_level': 'nonsense',
            'unsupported': ['amount over 1M VUV'],
        })
        with patch('apps.ai.llm._anthropic', return_value=answer):
            data = self.client.post('/api/ai/search/parse/', {'text': 'contracts last year over 1M VUV'}, format='json').json()
        self.assertEqual(data['filters'], {'documentType': 'contract', 'dateFrom': '2024-01-01'})  # camel-cased by the API renderer
        self.assertEqual(data['q'], 'contracts')
        self.assertEqual(data['unsupported'], ['amount over 1M VUV'])
