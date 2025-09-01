import type { DynamicTool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { END, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage, type AIMessage } from "@langchain/core/messages";

const tools: DynamicTool<any>[] = [];

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


const app = workflow.compile();

const finalState = await app.invoke({
    messages: [new HumanMessage("Hi there! How are you doing?")],
},
);

console.log(`Assistant:${finalState.messages[finalState.messages.length - 1]?.content}`);
