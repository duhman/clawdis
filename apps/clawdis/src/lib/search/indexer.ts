/**
 * Document Indexer for Clawdis
 * Manages document indexing with embeddings
 */

import type { GatewayClient } from "../gateway/client";
import { SearchDB, type SearchDocument } from "./lance-db";
import { getEmbedding, getMockEmbedding } from "./embeddings";

export interface IndexDocumentOptions {
  id: string;
  content: string;
  sessionKey?: string;
  messageId?: string;
  role?: "user" | "assistant";
  source?: string;
}

/**
 * Document Indexer Service
 * Handles document indexing with automatic embedding generation
 */
export class DocumentIndexer {
  private db: SearchDB;
  private client: GatewayClient | null = null;
  private useMockEmbeddings: boolean;

  constructor(options?: { dbPath?: string; useMockEmbeddings?: boolean }) {
    this.db = new SearchDB(options?.dbPath);
    this.useMockEmbeddings = options?.useMockEmbeddings ?? false;
  }

  /**
   * Initialize the indexer with a gateway client
   */
  async init(client?: GatewayClient): Promise<void> {
    this.client = client ?? null;
    await this.db.init();
  }

  /**
   * Close the indexer
   */
  async close(): Promise<void> {
    await this.db.close();
    this.client = null;
  }

  /**
   * Index a document with automatic embedding generation
   */
  async indexDocument(options: IndexDocumentOptions): Promise<void> {
    const embedding = await this.generateEmbedding(options.content);

    const doc: SearchDocument = {
      id: options.id,
      content: options.content,
      embedding,
      sessionKey: options.sessionKey,
      messageId: options.messageId,
      role: options.role,
      timestamp: Date.now(),
      source: options.source,
    };

    await this.db.indexDocument(doc);
  }

  /**
   * Index multiple documents at once
   */
  async indexDocuments(documents: IndexDocumentOptions[]): Promise<void> {
    if (documents.length === 0) return;

    const docs: SearchDocument[] = await Promise.all(
      documents.map(async (options) => {
        const embedding = await this.generateEmbedding(options.content);
        return {
          id: options.id,
          content: options.content,
          embedding,
          sessionKey: options.sessionKey,
          messageId: options.messageId,
          role: options.role,
          timestamp: Date.now(),
          source: options.source,
        };
      }),
    );

    await this.db.indexDocuments(docs);
  }

  /**
   * Search for similar documents using vector similarity
   */
  async search(query: string, limit: number = 10) {
    const embedding = await this.generateEmbedding(query);
    return this.db.search(embedding, limit);
  }

  /**
   * Search using full-text search
   */
  async searchFts(query: string, limit: number = 10) {
    return this.db.searchFts(query, limit);
  }

  /**
   * Create FTS index on content field
   */
  async createFtsIndex(): Promise<void> {
    await this.db.createFtsIndex();
  }

  /**
   * Check if FTS index exists
   */
  async hasFtsIndex(): Promise<boolean> {
    return this.db.hasFtsIndex();
  }

  /**
   * Hybrid search combining vector similarity and full-text search
   */
  async searchHybrid(query: string, limit: number = 10) {
    const embedding = await this.generateEmbedding(query);
    return this.db.searchHybrid(embedding, query, limit);
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<void> {
    await this.db.deleteDocument(id);
  }

  /**
   * Get document count
   */
  async count(): Promise<number> {
    return this.db.count();
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (this.useMockEmbeddings || !this.client?.connected) {
      // Use mock embeddings for testing or when gateway unavailable
      return getMockEmbedding(text);
    }

    try {
      return await getEmbedding(this.client, text);
    } catch {
      // Fallback to mock if gateway embedding fails
      console.warn("Gateway embedding failed, using mock embedding");
      return getMockEmbedding(text);
    }
  }
}
