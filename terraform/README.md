# Terraform - Airbnb Calendar Functions

Infraestructura como código para desplegar las Cloud Functions encargadas de sincronizar calendarios Airbnb.

## Requisitos

- Terraform >= 1.6
- Credenciales de GCP con permisos para crear Cloud Functions 2nd Gen, Cloud Storage y roles IAM.
- Haber compilado las funciones (`npm --prefix ../functions run build`).

## Variables principales

| Variable | Descripción | Default |
| --- | --- | --- |
| `project_id` | ID del proyecto de GCP | _n/a_ |
| `region` | Región de despliegue para Cloud Functions | `us-central1` |
| `environment` | Etiqueta de entorno | `dev` |
| `runtime` | Runtime de las funciones | `nodejs20` |
| `functions_bucket_name` | Bucket opcional (se autogenera si se deja vacío) | `""` |
| `functions_source_dir` | Ruta al artefacto compilado | `../functions/dist` |
| `firestore_location` | Región multi-estado para Firestore | `us-central` |
| `basic_auth_username` | Usuario Basic Auth para la API | `""` |
| `basic_auth_password` | Contraseña Basic Auth | `""` |
| `default_property_id` | ID del alojamiento por defecto | `default-property` |
| `allow_unauthenticated` | Permitir acceso sin auth (solo pruebas) | `false` |

## Uso

```bash
cd terraform
npm --prefix ../functions install
npm --prefix ../functions run build
terraform init
terraform plan -var="project_id=tu-proyecto" \
  -var="basic_auth_username=usuario" \
  -var="basic_auth_password=contraseña-segura"
terraform apply -var="project_id=tu-proyecto" \
  -var="basic_auth_username=usuario" \
  -var="basic_auth_password=contraseña-segura"
```

El output `calendar_api_uri` entrega la URL pública de la función HTTP.

> ⚠️ Ajusta los parámetros de IAM y los límites de memoria/timeout según las políticas de tu organización.
