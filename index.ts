import readline from 'node:readline/promises';
import type { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { END, MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage, type AIMessage } from "@langchain/core/messages";
import { createEventTool, getEventsTool } from "./tools";
import CallbackHandler from 'langfuse-langchain';

const tools: Array<DynamicTool | DynamicStructuredTool> = [getEventsTool, createEventTool];

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    temperature: 0,
}).bindTools(tools);

const toolNode = new ToolNode(tools);
async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);

    return { messages: [response] };
}

function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
        return "tools";
    }
    // Otherwise, we stop (reply to the user) using the special "__end__" node
    return "__end__";
}

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("assistant", callModel)
    .addEdge("__start__", "assistant")
    .addNode("tools", toolNode)
    .addEdge("tools", "assistant")
    .addConditionalEdges("assistant", shouldContinue, {
        tools: "tools",
        __end__: END,
    });

const checkpointer = new MemorySaver();

const langfuseHandler = new CallbackHandler({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
});

const app = workflow.compile({ checkpointer });

async function main() {

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let config = {
        configurable: { thread_id: '1' },
        callbacks: [langfuseHandler],
        metadata: { langfuseSessionId: "1" }
    };

    while (true) {
        const userInput = await rl.question('User: ');
        if (userInput.toLowerCase() === 'bye' || userInput.toLowerCase() === 'exit') {
            break;
        }

        const currentDateTime = new Date().toLocaleString('sv-SE').replace(' ', 'T');
        const timeZoneString = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const finalState = await app.invoke({
            messages: [
                new SystemMessage(`You are Meetly, a helpful calendar assistant.
                    You can help the user schedule meetings, add events to their calendar,
                    and provide information about their upcoming events.
                    If required, you can ask the user for more information.
                    The current date and time is ${currentDateTime} in the timezone ${timeZoneString}.`),
                new HumanMessage(userInput),
            ],
        },
            config
        );

        console.log(`Meetly:${finalState.messages[finalState.messages.length - 1]?.content}`);

    }
    rl.close();
}

main();
