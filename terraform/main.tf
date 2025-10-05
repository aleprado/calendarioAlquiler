name: Deploy

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  id-token: write
  deployments: write

jobs:
  validate_web:
    name: Build & Test Web
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install deps
        run: npm install
      - name: Lint
        run: npm run lint
      - name: Build
        run: npm run build
      - name: Upload web artifact
        uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: dist

  deploy_web:
    name: Deploy Firebase Hosting
    runs-on: ubuntu-latest
    needs: validate_web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: web-dist
          path: dist
      - name: SA sanity check (no keys)
        shell: bash
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: |
          set -euo pipefail
          echo "$FIREBASE_SERVICE_ACCOUNT" > sa.json
          node -e "JSON.parse(require('fs').readFileSync('sa.json','utf8'))"
          echo "client_email: $(jq -r .client_email sa.json)"
          echo "project_id:  $(jq -r .project_id sa.json)"
          echo "private_key_id (last6): $(jq -r .private_key_id sa.json | tail -c 7)"
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
        env:
          FIREBASE_CLI_EXPERIMENTS: webframeworks

  deploy_functions:
    name: Build Functions & Apply Terraform
    runs-on: ubuntu-latest
    needs: validate_web
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: |
            package-lock.json
            functions/package-lock.json

      - name: Install root deps
        run: npm install
      - name: Install function deps
        run: npm install
        working-directory: functions
      - name: Lint functions
        run: npm run lint
        working-directory: functions
      - name: Build functions
        run: npm run build
        working-directory: functions

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.6

      # Auth con la SA del secret GCP_SA_KEY
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
          create_credentials_file: true
          export_environment_variables: true
      - name: Configure gcloud
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
      - name: Verify account & project
        run: |
          echo "SA: $(jq -r .client_email $GOOGLE_GHA_CREDS_PATH)"
          gcloud auth list
          gcloud config set account "$(jq -r .client_email $GOOGLE_GHA_CREDS_PATH)"
          gcloud config set project ${{ secrets.GCP_PROJECT_ID }}

      # Init antes del import
      - name: Terraform Init
        run: terraform init
        working-directory: terraform

      # IMPORTAR App Engine existente (una sola vez; ignora error si ya está importada)
      - name: Terraform Import App Engine (one-off)
        run: terraform import google_app_engine_application.app "apps/${{ secrets.GCP_PROJECT_ID }}" || true
        working-directory: terraform

      - name: Terraform Fmt (check)
        run: terraform fmt -check -diff -recursive
        working-directory: terraform

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        working-directory: terraform
        env:
          TF_VAR_project_id: ${{ secrets.GCP_PROJECT_ID }}
          TF_VAR_basic_auth_username: ${{ secrets.GCP_FUNCTION_BASIC_AUTH_USER }}
          TF_VAR_basic_auth_password: ${{ secrets.GCP_FUNCTION_BASIC_AUTH_PASSWORD }}

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve tfplan
        working-directory: terraform
        env:
          TF_VAR_project_id: ${{ secrets.GCP_PROJECT_ID }}
          TF_VAR_basic_auth_username: ${{ secrets.GCP_FUNCTION_BASIC_AUTH_USER }}
          TF_VAR_basic_auth_password: ${{ secrets.GCP_FUNCTION_BASIC_AUTH_PASSWORD }}
