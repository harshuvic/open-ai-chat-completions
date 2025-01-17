//import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { splitTextIntoChunks } from '../services/utilitiess.service';
import { embed } from '../services/openai.service';
import { v4 as uuidv4 } from 'uuid';
import { upsertIndex } from '../services/embedder.service';

async function main() {
    const contents = readFileSync(join(__dirname, './../kdb.txt'), 'utf-8');
    const chunks = splitTextIntoChunks(contents);

    let i = 0;
    const len = chunks.length;
    const data = [];

    for (const chunk of chunks) {
        i++;

        const result = await embed(chunk);
        data.push({
            id: uuidv4(),
            values: result[0].embedding,
            metadata: {
                content: chunk,
            },
        });
    }

    await upsertIndex(data);
}

main().catch(console.error);
