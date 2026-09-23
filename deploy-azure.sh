#!/usr/bin/env bash
# ==============================================================================
# Script de Despliegue y Actualización para Azure Container Apps
# Sistema de Asignación de Materias - FCFM
# ==============================================================================
set -euo pipefail

# Colores para salida en consola
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

# Parámetros de Configuración en Azure
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-asignacion-materias}"
LOCATION="${LOCATION:-mexicocentral}"
ACR_NAME="${ACR_NAME:-acrasignacionfcfm}"
APP_NAME="${APP_NAME:-app-asignacion-materias}"
ENV_NAME="${ENV_NAME:-env-asignacion-materias}"
SQL_SERVER_NAME="${SQL_SERVER_NAME:-sql-fcfm-buap}"
SQL_DB_NAME="${SQL_DB_NAME:-AsignacionMateriasDB}"
SQL_ADMIN_USER="${SQL_ADMIN_USER:-adminfcfm}"
SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:-OY9MBgHYeBODz7DeuawNfqjQqPP0h+hh}"
IMAGE_NAME="asignacion-materias"
TAG="$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}  Despliegue y Publicación en Azure Container Apps${NC}"
echo -e "${BLUE}==============================================================================${NC}"

# 1. Validar herramientas locales requeridas
command -v az >/dev/null 2>&1 || { echo -e "${RED}Error: Azure CLI ('az') no está instalado.${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: Docker no está instalado o no se encuentra en el PATH.${NC}"; exit 1; }

# Validar sesión activa en Azure CLI
if ! az account show >/dev/null 2>&1; then
  echo -e "${YELLOW}No hay sesión activa en Azure CLI. Ejecutando 'az login'...${NC}"
  az login
fi

SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Conectado a Azure en la suscripción:${NC} ${SUBSCRIPTION_NAME}"

# Función: Aprovisionamiento Inicial de Infraestructura
init_infra() {
  echo -e "\n${YELLOW}=== INICIANDO APROVISIONAMIENTO INICIAL EN AZURE ===${NC}"
  
  echo -e "\n${BLUE}1. Verificando Grupo de Recursos '${RESOURCE_GROUP}'...${NC}"
  if [ "$(az group exists --name "${RESOURCE_GROUP}")" != "true" ]; then
    az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output none
    echo -e "${GREEN}✓ Grupo de recursos '${RESOURCE_GROUP}' creado en '${LOCATION}'.${NC}"
  else
    echo -e "${GREEN}✓ Grupo de recursos '${RESOURCE_GROUP}' ya existe.${NC}"
  fi

  echo -e "\n${BLUE}2. Verificando Azure Container Registry (ACR) '${ACR_NAME}'...${NC}"
  if ! az acr show --name "${ACR_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    az acr create --resource-group "${RESOURCE_GROUP}" --name "${ACR_NAME}" --location "${LOCATION}" --sku Basic --admin-enabled true --output none
    echo -e "${GREEN}✓ ACR '${ACR_NAME}' creado.${NC}"
  else
    echo -e "${GREEN}✓ ACR '${ACR_NAME}' ya existe y está listo.${NC}"
  fi

  echo -e "\n${BLUE}3. Configurando Azure SQL Server y Base de Datos Serverless en '${LOCATION}'...${NC}"
  if [ -z "${SQL_ADMIN_PASSWORD:-}" ]; then
    SQL_ADMIN_PASSWORD=$(openssl rand -base64 24)
    echo -e "${GREEN}✓ Contraseña generada automáticamente para Azure SQL:${NC} ${SQL_ADMIN_PASSWORD}"
    echo -e "${YELLOW}¡IMPORTANTE! Guarda esta contraseña en un lugar seguro.${NC}"
  fi

  # Crear Servidor SQL lógico si no existe
  if ! az sql server show --name "${SQL_SERVER_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    az sql server create \
      --name "${SQL_SERVER_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --admin-user "${SQL_ADMIN_USER}" \
      --admin-password "${SQL_ADMIN_PASSWORD}" \
      --output none
    echo -e "${GREEN}✓ Servidor SQL '${SQL_SERVER_NAME}' creado.${NC}"
  else
    echo -e "${GREEN}✓ Servidor SQL '${SQL_SERVER_NAME}' ya existe.${NC}"
  fi

  # Regla de firewall: permitir acceso desde servicios de Azure
  az sql server firewall-rule create \
    --resource-group "${RESOURCE_GROUP}" \
    --server "${SQL_SERVER_NAME}" \
    --name "AllowAzureServices" \
    --start-ip-address "0.0.0.0" \
    --end-ip-address "0.0.0.0" \
    --output none 2>/dev/null || true

  # Base de datos Serverless (pausa tras 4 horas = 240 minutos)
  if ! az sql db show --name "${SQL_DB_NAME}" --server "${SQL_SERVER_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    az sql db create \
      --resource-group "${RESOURCE_GROUP}" \
      --server "${SQL_SERVER_NAME}" \
      --name "${SQL_DB_NAME}" \
      --edition GeneralPurpose \
      --compute-model Serverless \
      --family Gen5 \
      --capacity 1 \
      --auto-pause-delay 240 \
      --output none
    echo -e "${GREEN}✓ Base de datos Serverless '${SQL_DB_NAME}' creada con pausa en 240 min.${NC}"
  else
    echo -e "${GREEN}✓ Base de datos '${SQL_DB_NAME}' ya existe.${NC}"
  fi

  echo -e "\n${BLUE}4. Configurando Entorno de Azure Container Apps en '${LOCATION}'...${NC}"
  if ! az containerapp env show --name "${ENV_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    az containerapp env create \
      --name "${ENV_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --output none
    echo -e "${GREEN}✓ Entorno Container Apps '${ENV_NAME}' creado.${NC}"
  else
    echo -e "${GREEN}✓ Entorno Container Apps '${ENV_NAME}' ya existe.${NC}"
  fi

  echo -e "\n${GREEN}✓ Toda la infraestructura base está lista.${NC}"
}

# Función: Compilar y Empujar Imagen Docker
build_and_push() {
  FULL_IMAGE_TAG="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}"
  LATEST_IMAGE_TAG="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"

  echo -e "\n${BLUE}Autenticando Docker en ACR (${ACR_NAME})...${NC}"
  az acr login --name "${ACR_NAME}"

  echo -e "\n${BLUE}Construyendo imagen Docker local [${TAG}]...${NC}"
  docker build -t "${FULL_IMAGE_TAG}" -t "${LATEST_IMAGE_TAG}" .

  echo -e "\n${BLUE}Subiendo imágenes a Azure Container Registry...${NC}"
  docker push "${FULL_IMAGE_TAG}"
  docker push "${LATEST_IMAGE_TAG}"

  echo -e "${GREEN}✓ Imágenes publicadas en ACR:${NC}"
  echo "  - ${FULL_IMAGE_TAG}"
  echo "  - ${LATEST_IMAGE_TAG}"
}

# Función: Actualizar o Crear la Container App
deploy_app() {
  FULL_IMAGE_TAG="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}"

  # Verificar si la Container App ya existe
  if az containerapp show --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    echo -e "\n${BLUE}Actualizando Azure Container App '${APP_NAME}' con la nueva imagen...${NC}"
    az containerapp update \
      --name "${APP_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --image "${FULL_IMAGE_TAG}" \
      --output none
  else
    echo -e "\n${YELLOW}La Container App no existe. Solicitando credenciales para creación inicial...${NC}"
    if [ -z "${PROD_ADMIN_PASSWORD:-}" ]; then
      read -s -p "Ingresa la contraseña ADMIN_PASSWORD para producción: " PROD_ADMIN_PASSWORD
      echo ""
    fi
    if [ -z "${SQL_ADMIN_PASSWORD:-}" ]; then
      read -s -p "Ingresa la contraseña de Azure SQL Database: " SQL_ADMIN_PASSWORD
      echo ""
    fi

    PROD_DB_URL="sqlserver://${SQL_SERVER_NAME}.database.windows.net:1433;database=${SQL_DB_NAME};user=${SQL_ADMIN_USER};password=${SQL_ADMIN_PASSWORD};encrypt=true;trustServerCertificate=false;"

    echo -e "\n${BLUE}Obteniendo credenciales de acceso a ACR...${NC}"
    ACR_USERNAME=$(az acr credential show --name "${ACR_NAME}" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "${ACR_NAME}" --query "passwords[0].value" -o tsv)

    echo -e "\n${BLUE}Creando Container App '${APP_NAME}' con secretos y escala a cero...${NC}"
    az containerapp create \
      --name "${APP_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --environment "${ENV_NAME}" \
      --image "${FULL_IMAGE_TAG}" \
      --target-port 3000 \
      --ingress external \
      --min-replicas 0 \
      --max-replicas 3 \
      --registry-server "${ACR_NAME}.azurecr.io" \
      --registry-username "${ACR_USERNAME}" \
      --registry-password "${ACR_PASSWORD}" \
      --secrets \
        db-connection-string="${PROD_DB_URL}" \
        admin-password="${PROD_ADMIN_PASSWORD}" \
      --env-vars \
        DATABASE_URL=secretref:db-connection-string \
        ADMIN_PASSWORD=secretref:admin-password \
        NODE_ENV="production" \
      --output none
  fi

  FQDN=$(az containerapp show --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" --query properties.configuration.ingress.fqdn -o tsv)
  echo -e "\n${GREEN}==============================================================================${NC}"
  echo -e "${GREEN}  ¡Despliegue Exitoso!${NC}"
  echo -e "${GREEN}  URL Pública: https://${FQDN}${NC}"
  echo -e "${GREEN}==============================================================================${NC}"
}

# Procesar argumentos
case "${1:-deploy}" in
  --init)
    init_infra
    build_and_push
    deploy_app
    ;;
  deploy)
    build_and_push
    deploy_app
    ;;
  --build-only)
    build_and_push
    ;;
  *)
    echo -e "${YELLOW}Uso:${NC}"
    echo "  ./deploy-azure.sh          # Compilar, subir imagen y actualizar la Container App"
    echo "  ./deploy-azure.sh --init   # Aprovisionamiento inicial completo de Azure + Despliegue"
    echo "  ./deploy-azure.sh --build-only  # Solo compilar y subir a ACR"
    exit 1
    ;;
esac
