terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "aiplatform.googleapis.com",
    "storage.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# GCS bucket for Veo video assets
resource "google_storage_bucket" "assets" {
  name     = var.gcs_bucket
  location = var.region
  project  = var.project_id

  uniform_bucket_level_access = true

  lifecycle {
    prevent_destroy = true
  }
}

# Cloud Run service
resource "google_cloud_run_v2_service" "backend" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  depends_on = [google_project_service.apis]

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    session_affinity = true
    timeout          = "3600s"

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      ports {
        container_port = 8080
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
        value = var.region
      }
      env {
        name  = "APP_ENV"
        value = "production"
      }
      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }
      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
      }
      env {
        name  = "ENABLE_IMAGEN"
        value = "true"
      }
      env {
        name  = "ENABLE_VEO"
        value = "true"
      }
      env {
        name  = "GCS_BUCKET"
        value = var.gcs_bucket
      }
    }
  }
}

# Allow unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
