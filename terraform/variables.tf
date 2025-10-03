variable "project_id" {
  description = "ID del proyecto de Google Cloud"
  type        = string
}

variable "region" {
  description = "Región donde se desplegarán las funciones"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Nombre corto del entorno (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "runtime" {
  description = "Runtime de Cloud Functions 2nd Gen"
  type        = string
  default     = "nodejs20"
}

variable "functions_bucket_name" {
  description = "Nombre del bucket donde se sube el código fuente. Si se omite se genera uno"
  type        = string
  default     = ""
}

variable "functions_source_dir" {
  description = "Directorio con los artefactos compilados de las funciones"
  type        = string
  default     = "../functions/dist"
}

variable "firestore_location" {
  description = "Región multi-estado para Firestore (por ejemplo us-central)"
  type        = string
  default     = "us-central"
}

variable "basic_auth_username" {
  description = "Usuario para autenticación básica en la API"
  type        = string
  default     = ""
}

variable "basic_auth_password" {
  description = "Contraseña para autenticación básica en la API"
  type        = string
  default     = ""
}

variable "default_property_id" {
  description = "Identificador por defecto del alojamiento"
  type        = string
  default     = "default-property"
}

variable "allow_unauthenticated" {
  description = "Permitir acceder a la API sin autenticación (solo uso en pruebas)"
  type        = bool
  default     = false
}
