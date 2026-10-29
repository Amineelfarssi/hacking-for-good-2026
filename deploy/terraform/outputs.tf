output "api_url" {
  description = "Cloud Run URL of the api service (FastAPI: ADK agent API + corpus routes)."
  value       = google_cloud_run_v2_service.api.uri
}

output "web_url" {
  description = "Cloud Run URL of the web UI."
  value       = google_cloud_run_v2_service.web.uri
}

output "corpus_bucket" {
  description = "Bucket that holds the corpus; deploy/upload_corpus.sh fills it."
  value       = google_storage_bucket.corpus.name
}

output "corpus_uri" {
  description = "CORPUS_DIR value for the Agent Engine deployment."
  value       = "gs://${google_storage_bucket.corpus.name}/${var.corpus_prefix}"
}

output "artifact_registry" {
  description = "Docker registry path; deploy/build.sh pushes api:<tag> and web:<tag> here."
  value       = local.registry
}

output "api_service_account" {
  description = "Runtime identity of the api; also used for the Agent Engine runtime."
  value       = google_service_account.api.email
}
