//import 'dotenv/config';
import { searchIndex } from '../services/embedder.service';
import { embed } from '../services/openai.service';

async function main() {
    const query = 'Error code 37037';
    const embeddings = await embed(query);

    const vector = embeddings[0].embedding;
    const matches = (await searchIndex(vector)).matches;

    console.log('Matches:', matches);
}

main().catch(console.error);
