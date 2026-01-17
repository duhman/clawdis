/**
 * LanceDB Wrapper for Clawdis
 * Provides local vector search capabilities
 *
 * NOTE: LanceDB requires native bindings and only works in Node.js/Tauri backend.
 * In browser environments, this module provides stub implementations.
 */

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceDBModule = any;
let lancedbModule: LanceDBModule | null = null;
let lancedbLoadAttempted = false;

async function getLanceDB(): Promise<LanceDBModule | null> {
  if (isBrowser) {
    console.warn("[LanceDB] Not available in browser environment");
    return null;
  }

  if (lancedbLoadAttempted) {
    return lancedbModule;
  }

  lancedbLoadAttempted = true;

  try {
    lancedbModule = await import("@lancedb/lancedb");
    return lancedbModule;
  } catch (err) {
    console.error("[LanceDB] Failed to load:", err);
    return null;
  }
}

// Document schema for search (LanceDB compatible)
export interface SearchDocument {
  id: string;
  content: string;
  embedding: number[];
  sessionKey?: string;
  messageId?: string;
  role?: string;
  timestamp?: number;
  source?: string;
  [key: string]: unknown; // Index signature for LanceDB compatibility
}

// Search result with similarity score
export interface SearchResult {
  document: SearchDocument;
  score: number;
}

// Database wrapper class
export class SearchDB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private table: any = null;
  private dbPath: string;
  private isAvailable = false;

  constructor(dbPath: string = ".clawdis/search.lancedb") {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    const lancedb = await getLanceDB();
    if (!lancedb) {
      console.warn("[SearchDB] LanceDB not available, search disabled");
      return;
    }

    this.db = await lancedb.connect(this.dbPath);
    this.isAvailable = true;

    // Create or open the documents table
    try {
      this.table = await this.db.openTable("documents");
    } catch {
      // Table doesn't exist, will be created on first insert
      this.table = null;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    // LanceDB connections are managed automatically
    this.db = null;
    this.table = null;
  }

  /**
   * Index a document with its embedding
   */
  async indexDocument(doc: SearchDocument): Promise<void> {
    if (!this.isAvailable || !this.db) {
      console.warn("[SearchDB] Not available, skipping indexDocument");
      return;
    }

    if (!this.table) {
      // Create table with first document
      this.table = await this.db.createTable("documents", [doc]);
    } else {
      await this.table.add([doc]);
    }
  }

  /**
   * Index multiple documents at once
   */
  async indexDocuments(docs: SearchDocument[]): Promise<void> {
    if (!this.isAvailable || !this.db) {
      console.warn("[SearchDB] Not available, skipping indexDocuments");
      return;
    }
    if (docs.length === 0) return;

    if (!this.table) {
      this.table = await this.db.createTable("documents", docs);
    } else {
      await this.table.add(docs);
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async search(
    embedding: number[],
    limit: number = 10,
  ): Promise<SearchResult[]> {
    if (!this.table) return [];

    const results = await this.table.search(embedding).limit(limit).toArray();

    return results.map((row: Record<string, unknown>) => ({
      document: {
        id: row.id as string,
        content: row.content as string,
        embedding: row.embedding as number[],
        sessionKey: row.sessionKey as string | undefined,
        messageId: row.messageId as string | undefined,
        role: row.role as string | undefined,
        timestamp: row.timestamp as number | undefined,
        source: row.source as string | undefined,
      },
      score: row._distance as number,
    }));
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.table) return;
    await this.table.delete(`id = '${id}'`);
  }

  /**
   * Get document count
   */
  async count(): Promise<number> {
    if (!this.table) return 0;
    return await this.table.countRows();
  }

  /**
   * Create full-text search index on content field
   */
  async createFtsIndex(): Promise<void> {
    if (!this.table) return;

    const lancedb = await getLanceDB();
    if (!lancedb) return;

    try {
      await this.table.createIndex("content", {
        config: lancedb.Index.fts(),
      });
    } catch {
      // Index may already exist, ignore error
    }
  }

  /**
   * Check if FTS index exists
   */
  async hasFtsIndex(): Promise<boolean> {
    if (!this.table) return false;

    try {
      const indices = await this.table.listIndices();
      return indices.some(
        (idx: { columns: string[]; indexType: string }) =>
          idx.columns.includes("content") && idx.indexType === "FTS",
      );
    } catch {
      return false;
    }
  }

  /**
   * Full-text search on content field
   */
  async searchFts(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.table) return [];

    const results = await this.table
      .search(query, "fts")
      .limit(limit)
      .toArray();

    return results.map((row: Record<string, unknown>) => ({
      document: {
        id: row.id as string,
        content: row.content as string,
        embedding: row.embedding as number[],
        sessionKey: row.sessionKey as string | undefined,
        messageId: row.messageId as string | undefined,
        role: row.role as string | undefined,
        timestamp: row.timestamp as number | undefined,
        source: row.source as string | undefined,
      },
      score: row._score as number,
    }));
  }

  /**
   * Hybrid search combining vector and FTS using Reciprocal Rank Fusion (RRF)
   * RRF formula: score = sum(1 / (k + rank)) where k=60 is a constant
   */
  async searchHybrid(
    embedding: number[],
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    if (!this.table) return [];

    const k = 60; // RRF constant

    // Run both searches in parallel
    const [vectorResults, ftsResults] = await Promise.all([
      this.search(embedding, limit * 2),
      this.searchFts(query, limit * 2),
    ]);

    // Build RRF scores
    const rrfScores = new Map<string, { score: number; doc: SearchDocument }>();

    // Add vector results with RRF score
    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = rrfScores.get(result.document.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        rrfScores.set(result.document.id, {
          score: rrfScore,
          doc: result.document,
        });
      }
    });

    // Add FTS results with RRF score
    ftsResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = rrfScores.get(result.document.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        rrfScores.set(result.document.id, {
          score: rrfScore,
          doc: result.document,
        });
      }
    });

    // Sort by RRF score (higher is better) and take top results
    const sorted = Array.from(rrfScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map((item) => ({
      document: item.doc,
      score: item.score,
    }));
  }
}
