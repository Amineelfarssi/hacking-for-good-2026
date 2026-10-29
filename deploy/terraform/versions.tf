terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Hackathon: local state. For anything longer-lived, move it to a GCS bucket:
  # backend "gcs" { bucket = "<state-bucket>"  prefix = "oncoprotocol-assist" }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
