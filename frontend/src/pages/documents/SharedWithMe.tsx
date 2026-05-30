import FileBrowser from '@/components/drive/FileBrowser'

export default function SharedWithMe() {
  return (
    <FileBrowser
      title="Shared with me"
      subtitle="Documents others shared with you via access grants or share links"
      breadcrumbs={[{ label: 'Shared with me' }]}
      defaultOrdering="-updated_at"
      filterParams={{ shared_with_me: 'true' }}
      driveMode
    />
  )
}
