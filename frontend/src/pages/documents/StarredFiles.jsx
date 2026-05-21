import FileBrowser from '../../components/drive/FileBrowser'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'

export default function StarredFiles() {
  return (
    <div className="space-y-4">
      <DriveBreadcrumbs items={[{ label: 'Starred' }]} />
      <FileBrowser
        title="Starred"
        subtitle="Documents you have marked with a star"
        defaultOrdering="-updated_at"
        filterParams={{ starred: 'true' }}
        showStarToggle
      />
    </div>
  )
}
