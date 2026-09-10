import type { IdeaSummary, JobSummary } from './types'

export function useIdeas() {
  const { data, error, pending, refresh } = useFetch<{ ideas: IdeaSummary[] }>('/api/ideas', {
    default: () => ({ ideas: [] }),
  })

  const ideas = computed(() => data.value.ideas)

  return { error, ideas, pending, refresh }
}

export async function fetchIdea(id: string): Promise<IdeaSummary | null> {
  const all = await $fetch<{ ideas: IdeaSummary[] }>('/api/ideas')
  return all.ideas.find(i => i.id === id) ?? null
}

export async function fetchLatestJob(ideaId: string): Promise<JobSummary | null> {
  const data = await $fetch<{ job: JobSummary | null }>(`/api/ideas/${ideaId}/latest-job`)
  return data.job
}
