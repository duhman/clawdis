/**
 * Launcher Commands System
 * Defines commands and provides fuzzy matching
 */

export interface Command {
  id: string;
  name: string;
  description: string;
  keywords?: string[];
  icon?: string;
  action: () => void | Promise<void>;
}

export interface CommandMatch {
  command: Command;
  score: number;
}

/**
 * Simple fuzzy match score calculation
 * Returns a score between 0 and 1, higher is better
 */
export function fuzzyMatch(query: string, target: string): number {
  if (!query) return 1;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 1;

  // Starts with query
  if (t.startsWith(q)) return 0.9;

  // Contains query as substring
  if (t.includes(q)) return 0.7;

  // Character-by-character fuzzy match
  let qIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 1 + consecutiveBonus;
      consecutiveBonus += 0.5;
      qIdx++;
    } else {
      consecutiveBonus = 0;
    }
  }

  // All query characters must be found
  if (qIdx < q.length) return 0;

  // Normalize score
  return Math.min(0.6, score / (q.length * 2));
}

/**
 * Search commands with fuzzy matching
 */
export function searchCommands(
  commands: Command[],
  query: string,
): CommandMatch[] {
  if (!query.trim()) {
    // Return all commands with default score
    return commands.map((command) => ({ command, score: 0.5 }));
  }

  const matches: CommandMatch[] = [];

  for (const command of commands) {
    // Match against name
    let bestScore = fuzzyMatch(query, command.name);

    // Match against description
    const descScore = fuzzyMatch(query, command.description) * 0.8;
    if (descScore > bestScore) bestScore = descScore;

    // Match against keywords
    if (command.keywords) {
      for (const keyword of command.keywords) {
        const keywordScore = fuzzyMatch(query, keyword) * 0.9;
        if (keywordScore > bestScore) bestScore = keywordScore;
      }
    }

    if (bestScore > 0) {
      matches.push({ command, score: bestScore });
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}
