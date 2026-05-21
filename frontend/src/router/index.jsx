import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ProtectedRoute from '../pages/auth/ProtectedRoute'

// Auth
import Login from '../pages/auth/Login'
import TwoFactor from '../pages/auth/TwoFactor'

// Dashboard
import Dashboard from '../pages/dashboard/Dashboard'

// Records
import RecordList from '../pages/records/RecordList'
import RecordUpload from '../pages/records/RecordUpload'

// Workflows
import WorkflowList from '../pages/workflows/WorkflowList'
import MyTasks from '../pages/workflows/MyTasks'

// Search
import SearchResults from '../pages/search/SearchResults'

// Compliance
import LegalHolds from '../pages/compliance/LegalHolds'
import DestructionScheduling from '../pages/compliance/DestructionScheduling'
import RetentionSchedule from '../pages/compliance/RetentionSchedule'
import OverdueRecords from '../pages/compliance/OverdueRecords'

// Correspondence
import CorrespondenceList from '../pages/correspondence/CorrespondenceList'

// Sharing
import SharedLinks from '../pages/sharing/SharedLinks'

// Analytics
import AnalyticsDashboard from '../pages/analytics/AnalyticsDashboard'
import AuditTrail from '../pages/analytics/AuditTrail'

// Admin
import UserManagement from '../pages/admin/UserManagement'
import SystemHealth from '../pages/admin/SystemHealth'

export default function AppRouter() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/two-factor" element={<TwoFactor />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Records */}
          <Route path="/records" element={<RecordList />} />
          <Route path="/records/upload" element={<RecordUpload />} />
          <Route path="/records/series" element={<RecordList />} />

          {/* Workflows */}
          <Route path="/workflows" element={<WorkflowList />} />
          <Route path="/workflows/my-tasks" element={<MyTasks />} />

          {/* Search */}
          <Route path="/search" element={<SearchResults />} />

          {/* Compliance */}
          <Route path="/compliance/legal-holds" element={<LegalHolds />} />
          <Route path="/compliance/destruction" element={<DestructionScheduling />} />
          <Route path="/compliance/retention" element={<RetentionSchedule />} />
          <Route path="/compliance/overdue" element={<OverdueRecords />} />

          {/* Correspondence */}
          <Route path="/correspondence" element={<CorrespondenceList />} />

          {/* Sharing */}
          <Route path="/sharing" element={<SharedLinks />} />

          {/* Analytics */}
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/analytics/audit" element={<AuditTrail />} />
          <Route path="/analytics/compliance" element={<AnalyticsDashboard />} />

          {/* Admin */}
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/health" element={<SystemHealth />} />
          <Route path="/admin/departments" element={<UserManagement />} />
          <Route path="/admin/api-keys" element={<UserManagement />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
