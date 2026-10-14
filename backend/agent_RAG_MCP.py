#import uvicorn

# Essential imports
import os
# Disable SSL verification for HuggingFace Hub (if necessary)
# os.environ["HF_HUB_DISABLE_SSL_VERIFICATION"] = "1"
# from langchain_community.embeddings import HuggingFaceEmbeddings # Will use this Local embedding model
from dotenv import load_dotenv

# Web API imports (FAST API and Pydantic)
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware  # CORS middleware for FastAPI

# LangChain (and community) imports
from langchain_community.document_loaders import PyPDFLoader
#from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings # switching to Azure OpenAI API
#from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
# the import below will require  -> pip install sentence-transformers

from langchain_core.prompts import ChatPromptTemplate
#from langchain_core.runnables import RunnablePassthrough
#from langchain_core.output_parsers import StrOutputParser
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain.agents import Tool
#import threading
from langchain_mcp_adapters.client import MultiServerMCPClient # may have to install langchain-mcp-adapters package

import asyncio # needed for async operations with MCP client 

# --- Load environment variables from .env file ---
# Resolve .env relative to this file so the command can be run from any cwd
_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_ENV_PATH)

azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

if not azure_openai_api_key or not azure_openai_endpoint:
    print("ERROR: AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are both required. Set them in backend/.env")
    raise SystemExit(1)

print("Azure OpenAI configuration found. Configuring clients...")

deployed_model_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
azure_endpoint = azure_openai_endpoint

# Initialize the LLM client with Azure OpenAI
llm = AzureChatOpenAI(
    azure_deployment=deployed_model_name,
    api_version=api_version,
    # temperature=0,    # Adjust as needed (0 for deterministic output)
    # max_tokens=None,  # Adjust as needed; will use default for now
    # timeout=None,     # Adjust as needed; will use default for now
    # max_retries=2,    # Adjust as needed; will use default for now
    openai_api_key=azure_openai_api_key,
    azure_endpoint=azure_endpoint,
)
print("Azure OpenAI LLM Chat Client configured.")

# --- RAG Pipeline Initialization ---

print("Initializing RAG pipeline...")

#embedding_model = OpenAIEmbeddings()  # Initialize the embedding model
#embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
embedding_model = AzureOpenAIEmbeddings(
    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002"),
    api_version=api_version,
    azure_endpoint=azure_endpoint,
    openai_api_key=azure_openai_api_key,
)

# Load the PDF document
loader = PyPDFLoader(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_docs.pdf"))
docs = loader.load()

# Split the document(s) into manageable chunks
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000,chunk_overlap=200)
splits = text_splitter.split_documents(docs)

# Create a vector store from the document chunks using the embedding model
vectorstore = FAISS.from_documents(documents=splits, embedding=embedding_model)  # Create a vector store from the document chunks
retriever = vectorstore.as_retriever() # this is the retriever that will be used to fetch relevant documents based on the query

print("Vector store and Retriever are ready.")

#template = "Answer based on context:\n{context}\n\nQuestion: {question}"
#prompt = ChatPromptTemplate.from_template(template)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# llm is already configured to use AzureChatOpenAI with Model gpt-4o
#llm = ChatOpenAI(model="gpt-3.5-turbo-0125")

# Commented out the RAG chain definition as it is not used in the final agent - we will use the Tool instead
# rag_chain = ({"context": retriever | format_docs, "question": RunnablePassthrough()} 
#              | prompt 
#              | llm 
#              | StrOutputParser())


# This is a helper function to format the documents that would be returned by the Retriever
def format_docs(docs): return "\n\n".join(doc.page_content for doc in docs)

# Define the RAG chain as a Tool
rag_tool = Tool(
    name="domain_knowledge_retriever",
    func=lambda q , config=None: 
        #[d.page_content for d in vectorstore.similarity_search(q, k=3)]
        #format_docs(vectorstore.similarity_search(q, k=3))
        format_docs(retriever.invoke(q, config=config))  # Use retriever to get documents
    ,
    description="Retrieves documents from the knowledge base based on the query",
)

tools = [rag_tool] # List of tools to be used by the agent - we just have one tool for now (RAG tool)

# Now, let's setup an MCP Tool

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8001/mcp")
server_configs = {"document": {"url": MCP_SERVER_URL, "transport": "sse"}}  # this is the MCP endpoint of the API
mcp_client = MultiServerMCPClient(server_configs)


# mcp_tools = await mcp_client.get_tools() # This is an async call to get the tools from the MCP server
# Define a synchronous wrapper function to get MCP tools (to avoid async issues in FastAPI)
# def get_mcp_tools_sync():
#     return asyncio.run(mcp_client.get_tools())

# Get the MCP tools using the synchronous wrapper function
#mcp_tools = get_mcp_tools_sync()

# Initialize mcp_tools as empty; will be populated on startup
mcp_tools = []
all_tools = tools  # Initially just the RAG tool

# --- FastAPI App Definition ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionInput(BaseModel): question: str
class AnswerResponse(BaseModel): answer: str

# Use FastAPI startup event to fetch MCP tools asynchronously and re-create the agent and executor
@app.on_event("startup")
async def load_mcp_tools():
    global mcp_tools, all_tools, agent, agent_executor
    mcp_tools = await mcp_client.get_tools()
    all_tools = tools + mcp_tools  # Combine RAG tool with MCP tools
    print("ALL Available tools:", [tool.name for tool in all_tools])
    # Re-create agent and executor with the updated tools
    agent = create_tool_calling_agent(
        llm,
        all_tools,
        prompt
    )
    print("Agent created successfully.")
    agent_executor = AgentExecutor(
        agent=agent,
        tools=all_tools,
        verbose=True # Set verbose to True to see detailed logs of the agent's reasoning process
    )
    print("Agent Executor is ready to be invoked with questions.")

# Initialize agent and executor as None; will be set on startup
agent_executor = None
#response = agent_executor.invoke({"input": question})

# This is a FastAPI Endpoint that will allow us to ask questions to the agent and get answers.
@app.post('/ask', response_model=AnswerResponse)
async def ask_question(query: QuestionInput):
    # Ensure agent_executor is initialized
    global agent_executor
    if agent_executor is None:
        return {'answer': "Agent is not ready yet. Please try again later."}
    
    print("\n--- QUESTION RECEIVED ---")  # This is the question received from the user
    print(f"Question: {query.question}")  # Print the question received from the user
    print("\n--- FINAL ANSWER ---")  # This is the final answer the agent provides after reasoning and using tools

    # Invoke the agent executor asynchronously with the question from the query
    response = await agent_executor.ainvoke({"input": query.question})  # Invoke the agent executor with the question
    #print(f"Answer: {response['output']}")  # Print the final answer from the agent executor
    return {'answer': response['output']}  # Return the final answer from the agent executor
    # invoking synchronously would return error when the MCP Tool (sse protocol) is used
    # response = agent_executor.invoke({"input": query.question})  # Invoke the agent executor with the question
    # #print("\n--- FINAL ANSWER ---")  # This is the final answer the agent provides after reasoning and using tools
    # return {'answer': response['output']}  # Return the final answer from the agent executor