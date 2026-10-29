"""Protocol assistant: a Google ADK agent grounded on a Vertex AI Search datastore.

Shape borrowed from rx-note-web/agents/chat (Strands + Bedrock): one agent, retrieval tools,
a system prompt that forces citations. Here the retrieval tool is Vertex AI Search.
"""

import os

from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.tools import VertexAiSearchTool

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
DATASTORE_LOCATION = os.environ.get("DATASTORE_LOCATION", "global")
DATASTORE_ID = os.environ.get("DATASTORE_ID", "bspho-protocols")
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

DATASTORE = (
    f"projects/{PROJECT}/locations/{DATASTORE_LOCATION}"
    f"/collections/default_collection/dataStores/{DATASTORE_ID}"
)

SYSTEM_PROMPT = """You are a documentation assistant for paediatric haematology and oncology
clinicians and researchers in Belgium. Your only knowledge is the set of clinical trial protocols
and institutional documents returned by the search tool.

Rules:
1. Search before you answer. Every factual statement is followed by a citation in the form
   [<document title> p:<page>]. A sentence without a citation is not allowed.
2. If the documents do not answer the question, say exactly: "Not in the documents I have." and
   suggest what document or section would normally contain it. Never fill a gap from general
   medical knowledge.
3. Doses, schedules, eligibility criteria, and stopping rules are quoted, not paraphrased, and
   always carry the protocol name and version/date when the document states one.
4. When two documents disagree, show both with citations and say they disagree. Do not pick.
5. Answer in the language of the question (English, Dutch or French). Keep the document's own
   terminology; do not translate drug or protocol names.
6. You support decisions; you do not make them. Never recommend a treatment for a specific patient.
"""

root_agent = Agent(
    name="protocol_assistant",
    model=MODEL,
    description="Answers clinicians' questions from trial protocols and institutional documents, with page citations.",
    instruction=SYSTEM_PROMPT,
    tools=[VertexAiSearchTool(data_store_id=DATASTORE)],
)
