import FileBrowser from '@/components/drive/FileBrowser'

export default function RecentFiles() {
  return (
    <FileBrowser
      title="Recent"
      subtitle="Files you've worked with recently"
      breadcrumbs={[{ label: 'Recent' }]}
      defaultOrdering="-updated_at"
      driveMode
    />
  )
}
