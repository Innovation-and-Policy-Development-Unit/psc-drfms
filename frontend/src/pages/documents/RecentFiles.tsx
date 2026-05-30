import FileBrowser from '@/components/drive/FileBrowser'
import DriveBreadcrumbs from '@/components/drive/DriveBreadcrumbs'

export default function RecentFiles() {
  return (
    <div className="space-y-4">
      <DriveBreadcrumbs items={[{ label: 'Recent' }]} />
    <FileBrowser
      title="Recent"
      subtitle="Files you've worked with recently"
      defaultOrdering="-updated_at"
      showStarToggle
    />
    </div>
  )
}
