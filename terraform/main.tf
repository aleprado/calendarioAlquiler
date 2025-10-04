terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.38"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.38"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

locals {
  default_bucket_name = "${var.project_id}-functions-${var.environment}"
  bucket_name         = var.functions_bucket_name != "" ? var.functions_bucket_name : local.default_bucket_name
  archive_path        = pathexpand("${path.module}/function.zip")
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "required" {
  for_each = toset([
    "appengine.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "firestore.googleapis.com",
    "run.googleapis.com",
  ])

  project = var.project_id
  service = each.key
}

resource "google_service_account" "functions" {
  account_id   = "airbnb-calendar-functions"
  display_name = "Airbnb Calendar Functions"
}

resource "google_project_iam_member" "functions_invoker" {
  for_each = toset([
    "roles/run.invoker",
    "roles/cloudfunctions.developer",
    "roles/storage.objectViewer",
    "roles/datastore.user",
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.functions.email}"
}

resource "google_storage_bucket" "functions_source" {
  name                        = local.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30
    }
  }
}

data "archive_file" "functions_bundle" {
  type        = "zip"
  source_dir  = var.functions_source_dir
  output_path = local.archive_path
}

resource "google_storage_bucket_object" "functions_source" {
  name   = "functions/bundle-${data.archive_file.functions_bundle.output_md5}.zip"
  bucket = google_storage_bucket.functions_source.name
  source = data.archive_file.functions_bundle.output_path
}

resource "google_app_engine_application" "app" {
  project       = var.project_id
  location_id   = var.firestore_location
  database_type = "CLOUD_FIRESTORE"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "default" {
  project          = var.project_id
  name             = "(default)"
  location_id      = var.firestore_location
  type             = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_app_engine_application.app]
}

resource "google_cloudfunctions2_function" "calendar_api" {
  name     = "calendar-api"
  location = var.region

  build_config {
    runtime     = var.runtime
    entry_point = "calendarApi"

    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = google_storage_bucket_object.functions_source.name
      }
    }
  }

  service_config {
    service_account_email = google_service_account.functions.email
    available_memory      = "512M"
    timeout_seconds       = 60
    ingress_settings      = "ALLOW_ALL"
    max_instance_count    = 5
    environment_variables = {
      NODE_ENV              = var.environment
      BASIC_AUTH_USER       = var.basic_auth_username
      BASIC_AUTH_PASSWORD   = var.basic_auth_password
      DEFAULT_PROPERTY_ID   = var.default_property_id
      ALLOW_UNAUTHENTICATED = var.allow_unauthenticated ? "true" : "false"
    }
  }

  depends_on = [
    google_project_service.required,
    google_firestore_database.default,
  ]
}

output "calendar_api_uri" {
  description = "URL público de la Cloud Function calendar-api"
  value       = google_cloudfunctions2_function.calendar_api.service_config[0].uri
}
