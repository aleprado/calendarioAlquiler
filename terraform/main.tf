terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.38"
    }
  }
}

variable "project_id" {
  type        = string
  description = "ID del proyecto GCP"
}

# Región que usás para funciones/recursos (no afecta Firestore ya creada)
variable "region" {
  type        = string
  description = "Región por defecto"
  default     = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# (Estricto y suficiente) Habilita la API de Firestore si faltaba
resource "google_project_service" "firestore_api" {
  project            = var.project_id
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

# Solo-lectura de la DB existente (no intenta crearla)
data "google_firestore_database" "default" {
  project = var.project_id
  name    = "(default)"
  depends_on = [google_project_service.firestore_api]
}

# ── Opcional: índices compuestos (ejemplo, adaptar a tu esquema) ─────────────
# resource "google_firestore_index" "reserva_por_fecha" {
#   project    = var.project_id
#   collection = "reservas"
#   fields {
#     field_path = "alojamientoId"
#     order      = "ASCENDING"
#   }
#   fields {
#     field_path = "fechaEntrada"
#     order      = "DESCENDING"
#   }
#   depends_on = [google_project_service.firestore_api]
# }
# ─────────────────────────────────────────────────────────────────────────────

# Salidas útiles
output "firestore_location" {
  description = "Región/ubicación de Firestore (ya establecida en la consola)"
  value       = data.google_firestore_database.default.location_id
}

output "firestore_type" {
  value = data.google_firestore_database.default.type
}
