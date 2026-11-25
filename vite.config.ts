import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { parseRepoStats, REPO_URL, repoSlug, type RepoStats } from './src/lib/repo.ts';

/**
 * Star and fork counts for the header card, read once here so the deployed page
 * does not ask GitHub for them. The deploy workflow passes GITHUB_TOKEN, which
 * lifts the API's limit of 60 unauthenticated requests an hour per address.
 * Without a network the build still succeeds and the card shows just the name.
 */
async function readRepoStats(): Promise<RepoStats | null> {
  const slug = repoSlug(REPO_URL);
  if (slug === null) return null;
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`GitHub answered ${String(response.status)}`);
    const stats = parseRepoStats(await response.json());
    if (stats === null) throw new Error('the response had no star and fork counts');
    return stats;
  } catch (error) {
    console.warn(`[3dsdex] repo card without counts: ${String(error)}`);
    return null;
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  // GitHub Pages serves project sites from /3DSdex/; local/portable builds use ./
  base: process.env.GITHUB_PAGES === 'true' ? '/3DSdex/' : './',
  plugins: [react()],
  define: {
    __REPO_STATS__: JSON.stringify(await readRepoStats()),
  },
}));
