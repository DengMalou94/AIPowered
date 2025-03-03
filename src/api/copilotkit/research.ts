import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, StateDefinition} from "@langchain/langgraph";
import { RunnableLambda } from "@langchain/core/runnables";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { init } from "next/dist/compiled/webpack/webpack";



export async function researchWithLangGraph(topic: string): Promise<any> {
    // function implementation
}
interface AgentState {
  topic: string;
  searchResults?: string; // Ensure this matches usage in the functions.
  article?: string;
  critique?: string;
}


function model() {
  return new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4-1106-preview",
  });
}

async function search(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  const retriever = new TavilySearchAPIRetriever({
    k: 10,
  });
  let topic = state.agentState.topic;
  // must be at least 5 characters long
  if (topic.length < 5) {
    topic = "topic: " + topic;
  }
  const docs = await retriever.getRelevantDocuments(topic);
  return {
    agentState: {
      ...state.agentState,
      searchResults: JSON.stringify(docs),
    },
  };
}

async function curate(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  const response = await model().invoke(
    [
      new SystemMessage(
        `You are a personal newspaper editor. 
         Your sole task is to return a list of URLs of the 5 most relevant articles for the provided topic or query as a JSON list of strings
         in this format:
         {
          urls: ["url1", "url2", "url3", "url4", "url5"]
         }
         .`.replace(/\s+/g, " ")
      ),
      new HumanMessage(
        `Today's date is ${new Date().toLocaleDateString("en-GB")}.
       Topic or Query: ${state.agentState.topic}
       
       Here is a list of articles:
       ${state.agentState.searchResults}`.replace(/\s+/g, " ")
      ),
    ],
    {
      response_format: {
        type: "json_object",
      },
    }
  );
  const urls = JSON.parse(response.content as string).urls;
  const searchResults = JSON.parse(state.agentState.searchResults!);
  const newSearchResults = searchResults.filter((result: any) => {
    return urls.includes(result.metadata.source);
  });
  return {
    agentState: {
      ...state.agentState,
      searchResults: JSON.stringify(newSearchResults),
    },
  };
}

async function critique(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  let feedbackInstructions = "";
  if (state.agentState.critique) {
    feedbackInstructions =
      `The writer has revised the article based on your previous critique: ${state.agentState.critique}
       The writer might have left feedback for you encoded between <FEEDBACK> tags.
       The feedback is only for you to see and will be removed from the final article.
    `.replace(/\s+/g, " ");
  }
  const response = await model().invoke([
    new SystemMessage(
      `You are a personal newspaper writing critique. Your sole purpose is to provide short feedback on a written 
      article so the writer will know what to fix.       
      Today's date is ${new Date().toLocaleDateString("en-GB")}
      Your task is to provide a really short feedback on the article only if necessary.
      if you think the article is good, please return [DONE].
      you can provide feedback on the revised article or just
      return [DONE] if you think the article is good.
      Please return a string of your critique or [DONE].`.replace(/\s+/g, " ")
    ),
    new HumanMessage(
      `${feedbackInstructions}
       This is the article: ${state.agentState.article}`
    ),
  ]);
  const content = response.content as string;
  console.log("critique:", content);
  return {
    agentState: {
      ...state.agentState,
      critique: content.includes("[DONE]") ? undefined : content,
    },
  };
}

async function write(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  const response = await model().invoke([
    new SystemMessage(
      `You are a personal newspaper writer. Your sole purpose is to write a well-written article about a 
      topic using a list of articles. Write 5 paragraphs in markdown.`.replace(
        /\s+/g,
        " "
      )
    ),
    new HumanMessage(
      `Today's date is ${new Date().toLocaleDateString("en-GB")}.
      Your task is to write a critically acclaimed article for me about the provided query or 
      topic based on the sources. 
      Here is a list of articles: ${state.agentState.searchResults}
      This is the topic: ${state.agentState.topic}
      Please return a well-written article based on the provided information.`.replace(
        /\s+/g,
        " "
      )
    ),
  ]);
  const content = response.content as string;
  return {
    agentState: {
      ...state.agentState,
      article: content,
    },
  };
}

async function revise(state: {
  agentState: AgentState;
}): Promise<{ agentState: AgentState }> {
  const response = await model().invoke([
    new SystemMessage(
      `You are a personal newspaper editor. Your sole purpose is to edit a well-written article about a 
      topic based on given critique.`.replace(/\s+/g, " ")
    ),
    new HumanMessage(
      `Your task is to edit the article based on the critique given.
      This is the article: ${state.agentState.article}
      This is the critique: ${state.agentState.critique}
      Please return the edited article based on the critique given.
      You may leave feedback about the critique encoded between <FEEDBACK> tags like this:
      <FEEDBACK> here goes the feedback ...</FEEDBACK>`.replace(/\s+/g, " ")
    ),
  ]);
  const content = response.content as string;
  return {
    agentState: {
      ...state.agentState,
      article: content,
    },
  };
}

const agentState = {
  agentState: {
    value: (x: AgentState, y: AgentState) => y,
    default: () => ({
      topic: "",
    }),
  },
  channels: [],
};

// Define the function that determines whether to continue or not
const shouldContinue = (state: { agentState: AgentState }) => {
  const result = state.agentState.critique === undefined ? "end" : "continue";
  return result;
};

const config: any = {
  lc_graph_name: "",
  State: {},
  Update: {},
  Node: {},
  spec: {},
};

const initialState = {};

const workflow = new StateGraph(initialState, config);


// Define the node names correctly
const nodes: { [key: string]: "__start__" } = {
  search: "__start__",
  curate: "__start__",
  write: "__start__",
  critique: "__start__",
  revise: "__start__",
};
// Use the node names correctly
workflow.addEdge(nodes.search, nodes.curate);
workflow.addEdge(nodes.curate, nodes.write);
workflow.addEdge(nodes.write, nodes.critique);

// ...

workflow.setEntryPoint(nodes.search);