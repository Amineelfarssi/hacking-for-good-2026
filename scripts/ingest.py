"""Upload data/docs/*.pdf to GCS, create the Vertex AI Search datastore (once) and import.

Mirrors the RxNote ingest lambda's job (PDF -> pages -> index) with Google's managed pieces:
Vertex AI Search parses layout and chunks per page, so page citations come for free.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.api_core.exceptions import AlreadyExists
from google.cloud import discoveryengine_v1 as de
from google.cloud import storage

load_dotenv()
PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
BUCKET = os.environ["GCS_BUCKET"]
LOCATION = os.environ.get("DATASTORE_LOCATION", "global")
DATASTORE_ID = os.environ.get("DATASTORE_ID", "bspho-protocols")
DOCS = Path(__file__).resolve().parent.parent / "data" / "docs"

parent = f"projects/{PROJECT}/locations/{LOCATION}/collections/default_collection"
datastore_name = f"{parent}/dataStores/{DATASTORE_ID}"


def upload() -> int:
    bucket = storage.Client(project=PROJECT).bucket(BUCKET)
    pdfs = sorted(DOCS.glob("*.pdf"))
    for pdf in pdfs:
        bucket.blob(f"docs/{pdf.name}").upload_from_filename(pdf)
    print(f"uploaded {len(pdfs)} pdf(s) to gs://{BUCKET}/docs/")
    return len(pdfs)


def ensure_datastore() -> None:
    client = de.DataStoreServiceClient()
    ds = de.DataStore(
        display_name="BSPHO protocols",
        industry_vertical=de.IndustryVertical.GENERIC,
        solution_types=[de.SolutionType.SOLUTION_TYPE_SEARCH],
        content_config=de.DataStore.ContentConfig.CONTENT_REQUIRED,
        document_processing_config=de.DocumentProcessingConfig(
            chunking_config=de.DocumentProcessingConfig.ChunkingConfig(
                layout_based_chunking_config=de.DocumentProcessingConfig.ChunkingConfig.LayoutBasedChunkingConfig(
                    chunk_size=500, include_ancestor_headings=True
                )
            ),
            default_parsing_config=de.DocumentProcessingConfig.ParsingConfig(
                layout_parsing_config=de.DocumentProcessingConfig.ParsingConfig.LayoutParsingConfig()
            ),
        ),
    )
    try:
        client.create_data_store(parent=parent, data_store=ds, data_store_id=DATASTORE_ID).result()
        print(f"created datastore {DATASTORE_ID}")
    except AlreadyExists:
        print(f"datastore {DATASTORE_ID} exists")


def import_docs() -> None:
    client = de.DocumentServiceClient()
    op = client.import_documents(
        de.ImportDocumentsRequest(
            parent=f"{datastore_name}/branches/default_branch",
            gcs_source=de.GcsSource(input_uris=[f"gs://{BUCKET}/docs/*.pdf"], data_schema="content"),
            reconciliation_mode=de.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
        )
    )
    print("import started:", op.operation.name)
    op.result(timeout=1800)
    print("import done (indexing continues for a few minutes)")


if __name__ == "__main__":
    if upload() == 0:
        sys.exit("no PDFs in data/docs/")
    ensure_datastore()
    import_docs()
