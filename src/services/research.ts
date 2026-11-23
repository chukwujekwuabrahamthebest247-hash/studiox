import { OpenRouterSettings, ResearchFinding } from '../types';

/**
 * Sanitizes and compacts a search query so Tavily / Serper always receive a clean, focused query
 * rather than raw code blocks or multi-paragraph prompts.
 */
export function sanitizeSearchQuery(rawQuery: string, maxLen = 220): string {
  const withoutCode = rawQuery
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[Attached File:[^\]]+\]/gi, ' ')
    .replace(/[#>*_`~|[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutCode.length <= maxLen) return withoutCode;
  const sliced = withoutCode.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim();
}

/**
 * Searches the web via Tavily AI Research Engine
 * Docs: https://docs.tavily.com/
 */
export async function searchTavily(query: string, apiKey: string): Promise<ResearchFinding> {
  const cleanQuery = sanitizeSearchQuery(query, 280);
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey.trim(),
      query: cleanQuery,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 5
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const summary = data.answer || 'Web research completed via Tavily.';
  const results = (data.results || []).map((r: any) => ({
    title: r.title || 'Source',
    url: r.url || '#',
    snippet: r.content || r.snippet || ''
  }));

  return {
    provider: 'tavily',
    query: cleanQuery,
    summary,
    results,
    timestamp: new Date().toLocaleTimeString()
  };
}

/**
 * Searches Google via Serper.dev API
 * Docs: https://serper.dev/playground
 */
export async function searchSerper(query: string, apiKey: string): Promise<ResearchFinding> {
  const cleanQuery = sanitizeSearchQuery(query, 240);
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey.trim(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: cleanQuery,
      num: 5
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const answer = data.answerBox?.answer || data.answerBox?.snippet || data.knowledgeGraph?.description || '';
  const results = (data.organic || []).map((r: any) => ({
    title: r.title || 'Search Result',
    url: r.link || '#',
    snippet: r.snippet || ''
  }));

  const summary = answer || (results[0]?.snippet ? `Extracted insights: ${results[0].snippet}` : 'Organic search completed via Serper.');

  return {
    provider: 'serper',
    query: cleanQuery,
    summary,
    results,
    timestamp: new Date().toLocaleTimeString()
  };
}

/**
 * Executes focused single-task web research using Tavily or Serper (one task at a time).
 */
export async function performTaskResearch(
  focusedQuery: string,
  settings: OpenRouterSettings,
  onProgress?: (msg: string) => void
): Promise<ResearchFinding | null> {
  const hasTavily = Boolean(settings.tavilyApiKey?.trim());
  const hasSerper = Boolean(settings.serperApiKey?.trim());

  if (!hasTavily && !hasSerper) {
    return null;
  }

  const cleanQuery = sanitizeSearchQuery(focusedQuery, 240);
  if (!cleanQuery) return null;

  if (hasTavily) {
    try {
      onProgress?.(`Researching via Tavily: "${cleanQuery.slice(0, 60)}${cleanQuery.length > 60 ? '...' : ''}"`);
      return await searchTavily(cleanQuery, settings.tavilyApiKey!);
    } catch (err: any) {
      console.warn('Tavily task search attempt encountered an issue:', err);
      if (hasSerper) {
        onProgress?.(`Switching to Serper: "${cleanQuery.slice(0, 60)}${cleanQuery.length > 60 ? '...' : ''}"`);
        return await searchSerper(cleanQuery, settings.serperApiKey!);
      }
      throw err;
    }
  } else if (hasSerper) {
    onProgress?.(`Researching via Serper: "${cleanQuery.slice(0, 60)}${cleanQuery.length > 60 ? '...' : ''}"`);
    return await searchSerper(cleanQuery, settings.serperApiKey!);
  }

  return null;
}

/**
 * Executes multi-engine "outside-the-box" web research using Tavily and/or Serper
 */
export async function performOutsideTheBoxResearch(
  prompt: string,
  settings: OpenRouterSettings,
  onProgress?: (msg: string) => void
): Promise<ResearchFinding | null> {
  const hasTavily = Boolean(settings.tavilyApiKey?.trim());
  const hasSerper = Boolean(settings.serperApiKey?.trim());

  if (!hasTavily && !hasSerper) {
    return null;
  }

  const cleanPrompt = sanitizeSearchQuery(prompt, 180);
  const searchPrompt = `${cleanPrompt} interactive web application implementation`.trim();

  if (hasTavily) {
    try {
      onProgress?.('Thinking outside the box: Researching web via Tavily AI...');
      return await searchTavily(searchPrompt, settings.tavilyApiKey!);
    } catch (err: any) {
      console.warn('Tavily search attempt encountered an issue:', err);
      if (hasSerper) {
        onProgress?.('Switching to Serper Google Search for outside-the-box insights...');
        return await searchSerper(searchPrompt, settings.serperApiKey!);
      }
      throw err;
    }
  } else if (hasSerper) {
    onProgress?.('Thinking outside the box: Researching web via Serper Google API...');
    return await searchSerper(searchPrompt, settings.serperApiKey!);
  }

  return null;
}

/**
 * Validates Serper API Key with a lightweight ping
 */
export async function testSerperKey(apiKey: string): Promise<boolean> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey.trim(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: 'ping test', num: 1 })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Serper verification failed (${res.status}): ${errorText}`);
  }
  return true;
}

/**
 * Validates Tavily API Key with a lightweight ping
 */
export async function testTavilyKey(apiKey: string): Promise<boolean> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey.trim(),
      query: 'ping test',
      max_results: 1
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Tavily verification failed (${res.status}): ${errorText}`);
  }
  return true;
}
