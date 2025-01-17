import OpenAI from 'openai';
import { createMessage, getAllMessages } from '../models/message.model';
import { searchIndex } from './embedder.service';
import { error } from 'console';
const openai = new OpenAI();
const instructions =
    "You are a customer support assistant for TechEase Solutions, a company that provides comprehensive IT services to businesses. Your role is to assist our clients with their technical issues, answer questions about our services, and provide guidance on using our products effectively. Always respond in a friendly, professional manner, and ensure your explanations are clear and concise. If you're unable to resolve an issue immediately, reassure the customer that you will escalate the problem and follow up promptly. Your goal is to provide exceptional support and ensure customer satisfaction.";
const systemInstruction = {
    role: 'system',
    content: instructions,
};

export async function sendMessage(threadId: string, content: { text: string; url?: string }) {
    console.log('sendMessage', threadId, JSON.stringify(content));
    const query = content.text;
    let responseText = 'Sorry I am not able to answer that question';

    const dbMessagesF = await getAllMessages(threadId);
    const dbMessages = dbMessagesF.map(message => {
        const item: any = {
            role: message.role,
            content: message.content,
        };
        if (message.tool_call_id) {
            item.tool_call_id = message.tool_call_id;
        }

        if (message.tool_calls) {
            item.tool_calls = message.tool_calls;
        }
        return item;
    });

    const latestMessage = {
        thread_id: threadId,
        role: 'user',
        content: query,
    };

    const messages: any[] = [systemInstruction, ...dbMessages, latestMessage];

    await createMessage(latestMessage);

    console.log('Messages sent to the chatbot', messages);

    const message = await createCompletions(messages);

    messages.push(message);

    if (message.tool_calls && message.tool_calls.length) {
        console.log('Tool calls recieved', message.tool_calls);

        const toolCallsObj: any = {
            thread_id: threadId,
            role: 'assistant',
            tool_calls: message.tool_calls,
        };

        console.log('Tool calls object', toolCallsObj);
        //await createMessage(toolCallsObj);

        const toolCalls = message.tool_calls;
        for (const toolCall of message.tool_calls) {
            if (toolCall.function && toolCall.function.name === 'getContext') {
                const functionArgs = JSON.parse(toolCall.function.arguments);
                console.log('Function arguments', functionArgs);
                console.log('Function arguments question', functionArgs.query);
                const context = await getContext(functionArgs.query).catch(error => console.log('I blow up here', error));

                const responseMessage = {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: context,
                };

                messages.push(responseMessage);

                /*await createMessage({
                    thread_id: threadId,
                    role: 'assistant',
                    tool_call_id: toolCall.id,
                });*/
            }
        }
        console.log('Messages sent with tools function execution', messages);
        const toolResponse = await createCompletions(messages);
        responseText = toolResponse.content;

        await createMessage({
            thread_id: threadId,
            role: 'assistant',
            content: responseText,
        });
    } else {
        responseText = message.content;
        await createMessage({
            thread_id: threadId,
            role: 'assistant',
            content: message.content,
        });
    }

    return { content: responseText };
}

async function createCompletions(messages: any[]) {
    console.log('****COMPLETIONS CALL****', messages);
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'getContext',
                    description: 'Retrieves the relavent context to answer the users IT/software related question',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'The users IT/software related question that requires additional context',
                            },
                        },
                        required: ['query'],
                        additionalProperties: false,
                    },
                    strict: true,
                },
            },
        ],
    });

    const message = completion.choices[0].message;
    console.log('****COMPLETIONS Response****', message);
    return message;
}

export async function embed(input: string) {
    console.log('****Embedding input****' + input);
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input,
    });

    return response.data;
}

async function getContext(query: string) {
    const embeddingResult = await embed(query);
    const matches = (await searchIndex(embeddingResult[0].embedding)).matches;
    return matches.length ? matches.map(match => match.metadata.content).join('\n\n') : '';
}
