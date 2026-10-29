locals {
  corpus_bucket = var.corpus_bucket != "" ? var.corpus_bucket : "${var.name}-corpus-${var.project_id}"
  registry      = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo}"
  api_image     = "${local.registry}/api:${var.api_image_tag}"
  web_image     = "${local.registry}/web:${var.web_image_tag}"
}

# ---------------------------------------------------------------- APIs

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "cloudbuild.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ---------------------------------------------------------------- Images and corpus

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.artifact_repo
  format        = "DOCKER"
  description   = "OncoProtocol Assist images (api, web)"
  depends_on    = [google_project_service.apis]
}

resource "google_storage_bucket" "corpus" {
  name                        = local.corpus_bucket
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true # hackathon: the corpus is re-uploadable from data/uc1
  depends_on                  = [google_project_service.apis]
}

# ---------------------------------------------------------------- Service accounts and IAM

resource "google_service_account" "api" {
  account_id   = "${var.name}-api"
  display_name = "OncoProtocol api (Cloud Run + Agent Engine runtime)"
  depends_on   = [google_project_service.apis]
}

resource "google_service_account" "web" {
  account_id   = "${var.name}-web"
  display_name = "OncoProtocol web (Cloud Run)"
  depends_on   = [google_project_service.apis]
}

# the api calls Gemini on Vertex AI ...
resource "google_project_iam_member" "api_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# The storage client inside Agent Engine sets a quota project; the runtime identity must be allowed to use it.
resource "google_project_iam_member" "api_serviceusage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ... and reads the corpus (objectAdmin so admin uploads can write back later)
resource "google_storage_bucket_iam_member" "api_corpus" {
  bucket = google_storage_bucket.corpus.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

# ---------------------------------------------------------------- Cloud Run: api

resource "google_cloud_run_v2_service" "api" {
  deletion_protection = false # hackathon: let terraform replace a failed revision
  name     = "${var.name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.api.email
    timeout                          = "300s"
    max_instance_request_concurrency = 20

    scaling {
      min_instance_count = 1
      max_instance_count = var.api_max_instances
    }

    containers {
      image = local.api_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle          = false # min 1 instance: keep the CPU on so the corpus stays warm
        startup_cpu_boost = true
      }

      # the corpus copy at start takes a little while: give the instance up to 4 minutes
      startup_probe {
        initial_delay_seconds = 10
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 24
        tcp_socket {
          port = 8080
        }
      }

      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "TRUE"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = "global" # the Gemini models are served from the global endpoint
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "GEMINI_FAST_MODEL"
        value = var.gemini_fast_model
      }
      env {
        name  = "GEMINI_THINKING"
        value = var.gemini_thinking
      }
      env {
        name  = "CORPUS_DIR"
        value = "/data/uc1"
      }
      env {
        name  = "CORPUS_BUCKET"
        value = google_storage_bucket.corpus.name
      }
      env {
        name  = "CORPUS_PREFIX"
        value = var.corpus_prefix
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.api_aiplatform,
    google_storage_bucket_iam_member.api_corpus,
  ]
}

# ---------------------------------------------------------------- Cloud Run: web

resource "google_cloud_run_v2_service" "web" {
  deletion_protection = false
  name     = "${var.name}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.web.email
    timeout         = "300s" # /api/chat streams the agent's answer (SSE) for up to a few minutes

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = local.web_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "ADK_URL"
        value = google_cloud_run_v2_service.api.uri
      }
      env {
        name  = "ADK_APP_NAME"
        value = "app"
      }
      env {
        name  = "ADK_USER_ID"
        value = "demo"
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------- Who may call the services

# Hackathon default: both public. Set public_invoker = false to lock down: the api then accepts only the web
# service account (the web routes would need to add an ID token to their fetch, see deploy/README.md), and the
# web UI only the principals in web_invokers.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  count    = var.public_invoker ? 1 : 0
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  count    = var.public_invoker ? 1 : 0
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "api_from_web" {
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.web.email}"
}

resource "google_cloud_run_v2_service_iam_member" "web_invokers" {
  for_each = var.public_invoker ? toset([]) : toset(var.web_invokers)
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = each.key
}
