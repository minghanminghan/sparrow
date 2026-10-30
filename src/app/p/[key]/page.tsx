import { ProjectPage } from '@/components/project/ProjectPage'

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <ProjectPage projectKey={key.toUpperCase()} />
}
