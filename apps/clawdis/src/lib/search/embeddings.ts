/**
 * Embedding Service for Clawdis
 * Generates embeddings for semantic search
 */

import type { GatewayClient } from "../gateway/client";

// Embedding dimensions (matches common models like text-embedding-ada-002)
export const EMBEDDING_DIM = 1536;

// Embedding response from gateway
interface EmbeddingResponse {
  embedding: number[];
}

/**
 * Generate embeddings using the gateway's embedding service
 */
export async function getEmbedding(
  client: GatewayClient,
  text: string,
): Promise<number[]> {
  if (!client.connected) {
    throw new Error("Gateway not connected");
  }

  const response = await client.request<EmbeddingResponse>("embed.text", {
    text,
  });

  return response.embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function getEmbeddings(
  client: GatewayClient,
  texts: string[],
): Promise<number[][]> {
  if (!client.connected) {
    throw new Error("Gateway not connected");
  }

  const response = await client.request<{ embeddings: number[][] }>(
    "embed.batch",
    { texts },
  );

  return response.embeddings;
}

/**
 * Fallback: Generate a simple hash-based "embedding" for testing
 * This is NOT a real embedding and should only be used for development
 */
export function getMockEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_DIM).fill(0);

  // Simple hash-based mock embedding
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const idx = (charCode * (i + 1)) % EMBEDDING_DIM;
    embedding[idx] = Math.sin(charCode * (i + 1)) * 0.5 + 0.5;
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}
