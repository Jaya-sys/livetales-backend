variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "valiant-arcana-479318-n4"
}

variable "region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "livetales-backend"
}

variable "image" {
  description = "Container image URL"
  type        = string
  default     = "us-central1-docker.pkg.dev/valiant-arcana-479318-n4/cloud-run-source-deploy/livetales-backend"
}

variable "cors_origins" {
  description = "Allowed CORS origins (comma-separated)"
  type        = string
  default     = "https://doodle-narrate-art.lovable.app,https://livetales-frontend-659171680418.us-central1.run.app"
}

variable "gcs_bucket" {
  description = "GCS bucket for Veo video assets"
  type        = string
  default     = "livetales-valiant"
}
