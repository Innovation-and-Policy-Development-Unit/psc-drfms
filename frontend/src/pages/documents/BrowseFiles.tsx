import FileBrowser from '@/components/drive/FileBrowser'

export default function BrowseFiles() {
  return (
    <FileBrowser
      title="All files"
      subtitle="Browse the organisation records registry"
      breadcrumbs={[{ label: 'All files' }]}
      defaultOrdering="-updated_at"
      enableBulk
      driveMode
    />
  )
}
