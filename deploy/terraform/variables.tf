variable "project_id" {
  description = "GCP project that hosts everything (lab project)."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry and the corpus bucket."
  type        = string
  default     = "europe-west1"
}

variable "name" {
  description = "Prefix for every resource name."
  type        = string
  default     = "oncoprotocol"
}

variable "artifact_repo" {
  description = "Artifact Registry docker repository id."
  type        = string
  default     = "oncoprotocol"
}

variable "corpus_bucket" {
  description = "Corpus bucket name (globally unique). Empty = <name>-corpus-<project_id>."
  type        = string
  default     = ""
}

variable "corpus_prefix" {
  description = "Object prefix in the corpus bucket under which data/uc1 is mirrored."
  type        = string
  default     = "uc1"
}

variable "api_image_tag" {
  description = "Tag of the api image in the Artifact Registry repo (deploy/build.sh pushes it)."
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  description = "Tag of the web image in the Artifact Registry repo."
  type        = string
  default     = "latest"
}

variable "gemini_model" {
  description = "Reasoning model for the agent (called through the global Vertex AI endpoint)."
  type        = string
  default     = "gemini-4-argon"
}

variable "gemini_fast_model" {
  description = "Fast model for non-agentic work."
  type        = string
  default     = "gemini-3.8-flash"
}

variable "gemini_thinking" {
  description = "Thinking level passed to the agent model."
  type        = string
  default     = "low"
}

variable "api_max_instances" {
  description = "ADK keeps sessions on the instance (SQLite in the container); 1 keeps a conversation on one instance."
  type        = number
  default     = 1
}

variable "public_invoker" {
  description = "true = allUsers may invoke both services (hackathon demo). false = only the web service account may call the api; add your own principals to web_invokers."
  type        = bool
  default     = true
}

variable "web_invokers" {
  description = "Principals allowed to open the web UI when public_invoker = false, e.g. [\"user:you@example.com\", \"domain:example.com\"]."
  type        = list(string)
  default     = []
}
