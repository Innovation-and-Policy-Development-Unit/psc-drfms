"""
Search + local suggestion tests.

Run:  python manage.py test tests.test_search --settings=config.settings.development
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.models import Record, RecordVersion
from apps.records.suggest import suggest_metadata
from apps.records.tasks import update_record_search_vector


def make_admin():
    return User.objects.create_user(
        email='admin@test.gov.vu', username='admin', first_name='A', last_name='B',
        password='Secur3Pass!', role=UserRole.ADMINISTRATOR,
    )


class SearchApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_admin()
        specs = [
            ('Teacher housing allowance review', 'policy', 'Ministry of Education', 'internal'),
            ('Annual budget expenditure report', 'financial', 'Ministry of Finance', 'confidential'),
            ('Disciplinary hearing outcome', 'disciplinary', 'Ministry of Education', 'restricted'),
        ]
        cls.records = []
        for title, dtype, ministry, level in specs:
            rec = Record.objects.create(
                title=title, document_type=dtype, originating_ministry=ministry,
                classification_level=level, custodian=cls.user, author=cls.user,
            )
            update_record_search_vector(str(rec.id))
            cls.records.append(rec)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_fulltext_match_and_facets(self):
        data = self.client.get('/api/search/', {'q': 'teacher housing'}).json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['title'], 'Teacher housing allowance review')
        types = {f['value']: f['count'] for f in data['facets']['documentType']}
        self.assertEqual(types, {'policy': 1})

    def test_typo_tolerance(self):
        data = self.client.get('/api/search/', {'q': 'dissiplinary hearing'}).json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['title'], 'Disciplinary hearing outcome')

    def test_facet_filter_keeps_alternatives(self):
        data = self.client.get('/api/search/', {'q': 'ministry', 'ministry': 'Ministry of Education'}).json()
        self.assertEqual(data['count'], 2)
        ministries = {f['value'] for f in data['facets']['ministry']}
        self.assertIn('Ministry of Finance', ministries)  # not erased by own filter

    def test_filters_only_browse_without_query(self):
        data = self.client.get('/api/search/', {'document_type': 'financial'}).json()
        self.assertEqual(data['count'], 1)

    def test_pagination(self):
        data = self.client.get('/api/search/', {'ministry': 'Ministry of Education', 'page_size': 1}).json()
        self.assertEqual((data['count'], data['pages'], len(data['results'])), (2, 2, 1))

    def test_garbled_query_still_finds_closest(self):
        data = self.client.get("/api/search/", {"q": "budgt expndture reprt"}).json()
        self.assertEqual(data["count"], 1)

    def test_no_results(self):
        data = self.client.get("/api/search/", {"q": "zzqqxx"}).json()
        self.assertEqual((data["count"], data["results"], data["didYouMean"]), (0, [], None))

    def test_suggest_endpoint(self):
        rows = self.client.get('/api/search/suggest/', {'q': 'budget'}).json()
        self.assertEqual(rows[0]['title'], 'Annual budget expenditure report')
        self.assertEqual(self.client.get('/api/search/suggest/', {'q': 'b'}).json(), [])

    def test_requires_auth(self):
        self.assertEqual(APIClient().get('/api/search/suggest/', {'q': 'budget'}).status_code, 401)


class LocalSuggestTests(TestCase):
    def test_contract_text(self):
        text = (
            "Ministry of Finance\nRef: MOF/2024/117\n12 March 2024\n\n"
            "Subject: Supply agreement\n\nThis agreement is made between the parties hereinafter "
            "called the supplier. Terms and conditions apply. Termination clause. Contract value 5,000,000 vatu."
        )
        out = suggest_metadata(text, ['Ministry of Finance'])
        self.assertEqual(out['document_type']['value'], 'contract')
        self.assertEqual(out['originating_ministry']['value'], 'Ministry of Finance')
        self.assertEqual(out['document_date']['value'], '2024-03-12')
        self.assertEqual(out['reference_number_format']['value'], 'MOF/2024/117')
        self.assertEqual(out['subject_line']['value'], 'Supply agreement')

    def test_empty_and_unclear_text(self):
        self.assertEqual(suggest_metadata(''), {})
        self.assertNotIn('document_type', suggest_metadata('hello world'))


class TypeaheadTypoTests(TestCase):
    def test_short_typo_matches_word_inside_long_title(self):
        user = make_admin()
        rec = Record.objects.create(
            title='Annual budget expenditure report 2023', document_type='financial',
            custodian=user, author=user,
        )
        update_record_search_vector(str(rec.id))
        client = APIClient()
        client.force_authenticate(user)
        rows = client.get('/api/search/suggest/', {'q': 'budgt'}).json()
        self.assertEqual([r['id'] for r in rows], [str(rec.id)])
