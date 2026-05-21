import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import DriveLayout from '../components/layout/DriveLayout'
import ProtectedRoute from '../pages/auth/ProtectedRoute'
import RequireRole from '../pages/auth/RequireRole'

import Login from '../pages/auth/Login'
import TwoFactor from '../pages/auth/TwoFactor'
import Unauthorized from '../pages/auth/Unauthorized'

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
import Inbox from '../pages/notifications/Inbox'
import AllSubmissions from '../pages/submissions/AllSubmissions'
import NewSubmission from '../pages/submissions/NewSubmission'
import AssignedSubmissions from '../pages/submissions/AssignedSubmissions'
import OverdueSLA from '../pages/submissions/OverdueSLA'
import AnalyticsDashboard from '../pages/analytics/AnalyticsDashboard'
import AuditTrail from '../pages/analytics/AuditTrail'
import UserManagement from '../pages/admin/UserManagement'
import SystemHealth from '../pages/admin/SystemHealth'

// Role sets — mirrors DriveSidebar and backend permission classes
const NO_RO   = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS = ['director', 'commissioner', 'administrator']
const ADMIN   = ['administrator']

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/two-factor" element={<TwoFactor />} />
      <Route path="/shared/:token" element={<SharedDocument />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DriveLayout />}>

          {/* ── All authenticated roles ── */}
          <Route path="/" element={<DocumentsHome />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Reviewer and above ── */}
          <Route element={<RequireRole roles={NO_RO} />}>
            <Route path="/submissions/assigned" element={<AssignedSubmissions />} />
            <Route path="/browse" element={<BrowseFiles />} />
            <Route path="/starred" element={<StarredFiles />} />
            <Route path="/shared-with-me" element={<SharedWithMe />} />
            <Route path="/recent" element={<RecentFiles />} />
            <Route path="/document/:id" element={<RecordDetail />} />
            <Route path="/workflows/my-tasks" element={<MyTasks />} />
            <Route path="/workflows/:id" element={<WorkflowDetail />} />
          </Route>

          {/* ── Records officer and above ── */}
          <Route element={<RequireRole roles={OFFICER} />}>
            <Route path="/submissions" element={<AllSubmissions />} />
            <Route path="/submissions/new" element={<NewSubmission />} />
            <Route path="/submissions/overdue" element={<OverdueSLA />} />
            <Route path="/upload" element={<RecordUpload />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/templates" element={<WorkflowTemplates />} />
            <Route path="/compliance/legal-holds" element={<LegalHolds />} />
            <Route path="/compliance/destruction" element={<DestructionScheduling />} />
            <Route path="/compliance/retention" element={<RetentionSchedule />} />
            <Route path="/compliance/overdue" element={<OverdueRecords />} />
            <Route path="/correspondence" element={<CorrespondenceList />} />
            <Route path="/sharing" element={<SharedLinks />} />
          </Route>

          {/* ── Director / Commissioner / Administrator ── */}
          <Route element={<RequireRole roles={DIRPLUS} />}>
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/analytics/audit" element={<AuditTrail />} />
          </Route>

          {/* ── Administrator only ── */}
          <Route element={<RequireRole roles={ADMIN} />}>
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/health" element={<SystemHealth />} />
          </Route>

          {/* Legacy redirects */}
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
