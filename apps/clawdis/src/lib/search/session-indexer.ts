/**
 * Session Indexer for Clawdis
 * Background service that indexes gateway chat sessions
 */

import type { GatewayClient } from "../gateway/client";
import type { EventFrame } from "../gateway/protocol";
import { DocumentIndexer, type IndexDocumentOptions } from "./indexer";

export interface SessionIndexerOptions {
  dbPath?: string;
  useMockEmbeddings?: boolean;
  batchSize?: number;
  indexOnEvent?: boolean;
}

interface PendingMessage {
  id: string;
  content: string;
  sessionKey: string;
  role: "user" | "assistant";
  timestamp: number;
}

/**
 * Session Indexer Service
 * Indexes chat messages from gateway sessions in the background
 */
export class SessionIndexer {
  private indexer: DocumentIndexer;
  private client: GatewayClient | null = null;
  private pending: PendingMessage[] = [];
  private batchSize: number;
  private indexOnEvent: boolean;
  private isProcessing = false;
  private eventCleanup: (() => void) | null = null;

  constructor(options: SessionIndexerOptions = {}) {
    this.indexer = new DocumentIndexer({
      dbPath: options.dbPath,
      useMockEmbeddings: options.useMockEmbeddings,
    });
    this.batchSize = options.batchSize ?? 10;
    this.indexOnEvent = options.indexOnEvent ?? true;
  }

  /**
   * Initialize and start listening for events
   */
  async start(client: GatewayClient): Promise<void> {
    this.client = client;
    await this.indexer.init(client);

    if (this.indexOnEvent) {
      this.eventCleanup = this.subscribeToEvents();
    }
  }

  /**
   * Stop the indexer and cleanup
   */
  async stop(): Promise<void> {
    this.eventCleanup?.();
    this.eventCleanup = null;

    // Process any remaining pending messages
    if (this.pending.length > 0) {
      await this.processBatch();
    }

    await this.indexer.close();
    this.client = null;
  }

  /**
   * Subscribe to gateway chat events
   * Note: The actual event subscription happens via GatewayClient callbacks.
   * This method sets up the cleanup function.
   */
  private subscribeToEvents(): () => void {
    if (!this.client) return () => {};

    // The GatewayClient emits events through callbacks set in options
    // The caller should pass events to handleEvent() from their event handler

    return () => {
      // Cleanup logic - nothing to cleanup currently as events are passed in
    };
  }

  /**
   * Handle incoming gateway events
   */
  handleEvent(event: EventFrame): void {
    const payload = event.payload as Record<string, unknown> | undefined;

    switch (event.event) {
      case "chat.complete": {
        // Index completed assistant messages
        const messageId = payload?.messageId as string | undefined;
        const content = payload?.content as string | undefined;
        const sessionKey = payload?.sessionKey as string | undefined;

        if (messageId && content && sessionKey) {
          this.queueMessage({
            id: messageId,
            content,
            sessionKey,
            role: "assistant",
            timestamp: Date.now(),
          });
        }
        break;
      }

      case "chat.user-message": {
        // Index user messages
        const messageId = payload?.messageId as string | undefined;
        const content = payload?.content as string | undefined;
        const sessionKey = payload?.sessionKey as string | undefined;

        if (messageId && content && sessionKey) {
          this.queueMessage({
            id: messageId,
            content,
            sessionKey,
            role: "user",
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  }

  /**
   * Queue a message for indexing
   */
  private queueMessage(message: PendingMessage): void {
    this.pending.push(message);

    if (this.pending.length >= this.batchSize && !this.isProcessing) {
      this.processBatch().catch(console.error);
    }
  }

  /**
   * Process pending messages in batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pending.length === 0) return;

    this.isProcessing = true;

    try {
      const batch = this.pending.splice(0, this.batchSize);

      const docs: IndexDocumentOptions[] = batch.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sessionKey: msg.sessionKey,
        messageId: msg.id,
        role: msg.role,
        source: "gateway-session",
      }));

      await this.indexer.indexDocuments(docs);
    } catch (err) {
      console.error("Failed to index session messages:", err);
    } finally {
      this.isProcessing = false;

      // Process more if we have pending messages
      if (this.pending.length >= this.batchSize) {
        this.processBatch().catch(console.error);
      }
    }
  }

  /**
   * Manually index a batch of messages (for historical data)
   */
  async indexMessages(
    messages: Array<{
      id: string;
      content: string;
      sessionKey: string;
      role: "user" | "assistant";
    }>,
  ): Promise<void> {
    const docs: IndexDocumentOptions[] = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sessionKey: msg.sessionKey,
      messageId: msg.id,
      role: msg.role,
      source: "gateway-session",
    }));

    await this.indexer.indexDocuments(docs);
  }

  /**
   * Get count of indexed documents
   */
  async count(): Promise<number> {
    return this.indexer.count();
  }

  /**
   * Force processing of any pending messages
   */
  async flush(): Promise<void> {
    while (this.pending.length > 0 || this.isProcessing) {
      await this.processBatch();
      // Small delay to allow processing to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
