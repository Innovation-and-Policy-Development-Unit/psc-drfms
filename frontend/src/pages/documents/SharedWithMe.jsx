import FileBrowser from '../../components/drive/FileBrowser'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'

export default function SharedWithMe() {
  return (
    <div className="space-y-4">
      <DriveBreadcrumbs items={[{ label: 'Shared with me' }]} />
      <FileBrowser
        title="Shared with me"
        subtitle="Documents others shared with you via access grants or share links"
        defaultOrdering="-updated_at"
        filterParams={{ shared_with_me: 'true' }}
      />
    </div>
  )
}
