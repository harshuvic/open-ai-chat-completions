import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

const index = pc.index('aid');

export async function upsertIndex(data: any) {
    return await index.upsert(data);
}

export async function searchIndex(vector: number[]) {
    return await index.query({ vector, topK: 3, includeMetadata: true });
}
