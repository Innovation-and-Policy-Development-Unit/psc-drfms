import FileBrowser from '../../components/drive/FileBrowser'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'

export default function BrowseFiles() {
  return (
    <div className="space-y-4">
      <DriveBreadcrumbs items={[{ label: 'All files' }]} />
      <FileBrowser
        title="All files"
        subtitle="Browse your organization document library"
        defaultOrdering="-updated_at"
        enableBulk
        showStarToggle
      />
    </div>
  )
}
