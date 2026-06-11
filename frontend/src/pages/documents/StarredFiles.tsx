import FileBrowser from '@/components/drive/FileBrowser'

export default function StarredFiles() {
  return (
    <FileBrowser
      title="Starred"
      subtitle="Documents you have marked with a star"
      breadcrumbs={[{ label: 'Starred' }]}
      defaultOrdering="-updated_at"
      filterParams={{ starred: 'true' }}
      driveMode
    />
  )
}
