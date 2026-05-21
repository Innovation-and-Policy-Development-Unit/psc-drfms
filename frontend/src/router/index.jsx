import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import DriveLayout from '../components/layout/DriveLayout'
import ProtectedRoute from '../pages/auth/ProtectedRoute'

import Login from '../pages/auth/Login'
import TwoFactor from '../pages/auth/TwoFactor'

import DocumentsHome from '../pages/documents/DocumentsHome'
import BrowseFiles from '../pages/documents/BrowseFiles'
import RecentFiles from '../pages/documents/RecentFiles'
import StarredFiles from '../pages/documents/StarredFiles'
import SharedWithMe from '../pages/documents/SharedWithMe'
import RecordDetail from '../pages/documents/RecordDetail'
import RecordUpload from '../pages/records/RecordUpload'

import WorkflowList from '../pages/workflows/WorkflowList'
import MyTasks from '../pages/workflows/MyTasks'
import WorkflowDetail from '../pages/workflows/WorkflowDetail'
import WorkflowTemplates from '../pages/workflows/WorkflowTemplates'
import SearchResults from '../pages/search/SearchResults'
import LegalHolds from '../pages/compliance/LegalHolds'
import DestructionScheduling from '../pages/compliance/DestructionScheduling'
import RetentionSchedule from '../pages/compliance/RetentionSchedule'
import OverdueRecords from '../pages/compliance/OverdueRecords'
import CorrespondenceList from '../pages/correspondence/CorrespondenceList'
import SharedLinks from '../pages/sharing/SharedLinks'
import SharedDocument from '../pages/sharing/SharedDocument'
import AnalyticsDashboard from '../pages/analytics/AnalyticsDashboard'
import AuditTrail from '../pages/analytics/AuditTrail'
import UserManagement from '../pages/admin/UserManagement'
import SystemHealth from '../pages/admin/SystemHealth'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/two-factor" element={<TwoFactor />} />
      <Route path="/shared/:token" element={<SharedDocument />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DriveLayout />}>
          <Route path="/" element={<DocumentsHome />} />
          <Route path="/browse" element={<BrowseFiles />} />
          <Route path="/starred" element={<StarredFiles />} />
          <Route path="/shared-with-me" element={<SharedWithMe />} />
          <Route path="/recent" element={<RecentFiles />} />
          <Route path="/upload" element={<RecordUpload />} />
          <Route path="/document/:id" element={<RecordDetail />} />

          <Route path="/search" element={<SearchResults />} />
          <Route path="/workflows" element={<WorkflowList />} />
          <Route path="/workflows/my-tasks" element={<MyTasks />} />
          <Route path="/workflows/templates" element={<WorkflowTemplates />} />
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
          <Route path="/compliance/legal-holds" element={<LegalHolds />} />
          <Route path="/compliance/destruction" element={<DestructionScheduling />} />
          <Route path="/compliance/retention" element={<RetentionSchedule />} />
          <Route path="/compliance/overdue" element={<OverdueRecords />} />
          <Route path="/correspondence" element={<CorrespondenceList />} />
          <Route path="/sharing" element={<SharedLinks />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/analytics/audit" element={<AuditTrail />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/health" element={<SystemHealth />} />

          {/* Legacy paths */}
          <Route path="/records" element={<Navigate to="/browse" replace />} />
          <Route path="/records/upload" element={<Navigate to="/upload" replace />} />
          <Route path="/records/:id" element={<LegacyRecordRedirect />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

function LegacyRecordRedirect() {
  const { id } = useParams()
  return <Navigate to={`/document/${id}`} replace />
}
