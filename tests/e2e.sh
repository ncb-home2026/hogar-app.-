#!/bin/bash

# Script de pruebas E2E para la app Gastos del Hogar
# Simula flujos de usuario completos incluyendo todas las acciones de botones

set -e

API_URL="${API_URL:-http://localhost:4000/api}"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Colores para output
info() { echo -e "${BOLD}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
test_name() { echo -e "\n${BOLD}${YELLOW}=== $1 ===${NC}"; }

# Verificar que el API esté disponible
check_api() {
  info "Verificando conexión con API en $API_URL..."
  if ! curl -s "$API_URL/resumen" -H "Authorization: Bearer invalid" > /dev/null 2>&1; then
    error "No se puede alcanzar el API. Asegúrate de que los contenedores estén corriendo con 'docker compose up -d --build'"
  fi
  success "API disponible"
}

# TEST 1: Registro e inicio de sesión
test_auth() {
  test_name "Autenticación: Registro e Inicio de Sesión"
  
  USUARIO="testuser_$(date +%s)"
  PASSWORD="TestPassword123!"
  
  # Registro
  info "Registrando usuario: $USUARIO"
  RESPONSE=$(curl -s -X POST "$API_URL/auth/registro" \
    -H "Content-Type: application/json" \
    -d "{\"nombre\": \"Test User\", \"usuario\": \"$USUARIO\", \"password\": \"$PASSWORD\"}")
  
  TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
  [[ -z "$TOKEN" ]] && error "No se obtuvo token en registro. Respuesta: $RESPONSE"
  success "Usuario registrado y token obtenido"
  
  # Login
  info "Iniciando sesión con usuario: $USUARIO"
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"usuario\": \"$USUARIO\", \"password\": \"$PASSWORD\"}")
  
  LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
  [[ -z "$LOGIN_TOKEN" ]] && error "No se pudo iniciar sesión. Respuesta: $LOGIN_RESPONSE"
  success "Inicio de sesión exitoso"
  
  # Guardamos el token para pruebas posteriores
  export TOKEN="$LOGIN_TOKEN"
}

# TEST 2: Agregar personas (salarios)
test_personas() {
  test_name "Botón: Agregar Persona/Salario"
  
  info "Agregando persona 1: Juan (salario $2000)"
  PERSONA1=$(curl -s -X POST "$API_URL/personas" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"nombre": "Juan", "salario": 2000, "frecuencia": "mensual"}')
  
  PERSONA1_ID=$(echo "$PERSONA1" | jq -r '.id // empty')
  [[ -z "$PERSONA1_ID" ]] && error "No se pudo agregar persona. Respuesta: $PERSONA1"
  success "Persona agregada con ID: $PERSONA1_ID"
  
  info "Agregando persona 2: María (salario $1800, quincenal)"
  PERSONA2=$(curl -s -X POST "$API_URL/personas" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"nombre": "María", "salario": 1800, "frecuencia": "quincenal"}')
  
  PERSONA2_ID=$(echo "$PERSONA2" | jq -r '.id // empty')
  [[ -z "$PERSONA2_ID" ]] && error "No se pudo agregar segunda persona. Respuesta: $PERSONA2"
  success "Segunda persona agregada con ID: $PERSONA2_ID"
  
  # Obtener lista de personas
  info "Obteniendo lista de personas"
  PERSONAS_LIST=$(curl -s "$API_URL/personas" \
    -H "Authorization: Bearer $TOKEN")
  
  PERSONAS_COUNT=$(echo "$PERSONAS_LIST" | jq 'length')
  [[ "$PERSONAS_COUNT" -lt 2 ]] && error "No se listaron correctamente las personas. Respuesta: $PERSONAS_LIST"
  success "Se obtuvieron $PERSONAS_COUNT personas"
  
  export PERSONA1_ID PERSONA2_ID
}

# TEST 3: Agregar gastos fijos
test_gastos_fijos() {
  test_name "Botón: Agregar Gasto Fijo"
  
  info "Agregando gasto fijo 1: Renta ($1200)"
  GASTO1=$(curl -s -X POST "$API_URL/gastos-fijos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"nombre": "Renta", "categoria": "vivienda", "monto": 1200, "dia_vencimiento": 1, "estado": "pendiente"}')
  
  GASTO1_ID=$(echo "$GASTO1" | jq -r '.id // empty')
  [[ -z "$GASTO1_ID" ]] && error "No se pudo agregar gasto fijo. Respuesta: $GASTO1"
  success "Gasto fijo agregado con ID: $GASTO1_ID"
  
  info "Agregando gasto fijo 2: Internet ($50)"
  GASTO2=$(curl -s -X POST "$API_URL/gastos-fijos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"nombre": "Internet", "categoria": "servicios", "monto": 50, "dia_vencimiento": 10, "estado": "pendiente"}')
  
  GASTO2_ID=$(echo "$GASTO2" | jq -r '.id // empty')
  [[ -z "$GASTO2_ID" ]] && error "No se pudo agregar segundo gasto fijo. Respuesta: $GASTO2"
  success "Segundo gasto fijo agregado con ID: $GASTO2_ID"
  
  # Obtener lista
  GASTOS_LIST=$(curl -s "$API_URL/gastos-fijos" \
    -H "Authorization: Bearer $TOKEN")
  
  GASTOS_COUNT=$(echo "$GASTOS_LIST" | jq 'length')
  [[ "$GASTOS_COUNT" -lt 2 ]] && error "No se listaron correctamente los gastos. Respuesta: $GASTOS_LIST"
  success "Se obtuvieron $GASTOS_COUNT gastos fijos"
  
  export GASTO1_ID GASTO2_ID
}

# TEST 4: Cambiar estado de gasto (dropdown select)
test_cambiar_estado_gasto() {
  test_name "Botón/Select: Cambiar Estado de Gasto a Pagado"
  
  info "Obteniendo gasto $GASTO1_ID para ver su estado actual"
  GASTO_ACTUAL=$(curl -s "$API_URL/gastos-fijos" \
    -H "Authorization: Bearer $TOKEN" | jq ".[] | select(.id == $GASTO1_ID)")
  
  success "Gasto actual: $(echo "$GASTO_ACTUAL" | jq -r '.nombre + " - " + .estado')"
  
  info "Cambiando estado a 'pagado'"
  ESTADO_CAMBIO=$(curl -s -X PUT "$API_URL/gastos-fijos/$GASTO1_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"nombre\": \"Renta\", \"categoria\": \"vivienda\", \"monto\": 1200, \"dia_vencimiento\": 1, \"estado\": \"pagado\"}")
  
  [[ -z "$(echo "$ESTADO_CAMBIO" | jq -r '.ok // empty')" ]] && error "No se pudo cambiar estado. Respuesta: $ESTADO_CAMBIO"
  success "Estado cambiado a pagado"
  
  # Verificar cambio
  GASTO_VERIFICADO=$(curl -s "$API_URL/gastos-fijos" \
    -H "Authorization: Bearer $TOKEN" | jq ".[] | select(.id == $GASTO1_ID) | .estado" -r)
  
  [[ "$GASTO_VERIFICADO" != "pagado" ]] && error "El estado no se actualizó correctamente. Actual: $GASTO_VERIFICADO"
  success "Verificado: estado es ahora '$GASTO_VERIFICADO'"
}

# TEST 5: Agregar compra planificada
test_compras() {
  test_name "Botón: Agregar Compra Planificada"
  
  MES=$(date +%Y-%m)
  
  info "Agregando compra: Laptop ($800, alta prioridad)"
  COMPRA1=$(curl -s -X POST "$API_URL/compras" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"nombre\": \"Laptop\", \"monto_estimado\": 800, \"prioridad\": \"alta\", \"mes\": \"$MES\"}")
  
  COMPRA1_ID=$(echo "$COMPRA1" | jq -r '.id // empty')
  [[ -z "$COMPRA1_ID" ]] && error "No se pudo agregar compra. Respuesta: $COMPRA1"
  success "Compra agregada con ID: $COMPRA1_ID"
  
  info "Agregando compra: Mueble ($300, media prioridad)"
  COMPRA2=$(curl -s -X POST "$API_URL/compras" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"nombre\": \"Mueble para sala\", \"monto_estimado\": 300, \"prioridad\": \"media\", \"mes\": \"$MES\"}")
  
  COMPRA2_ID=$(echo "$COMPRA2" | jq -r '.id // empty')
  [[ -z "$COMPRA2_ID" ]] && error "No se pudo agregar segunda compra. Respuesta: $COMPRA2"
  success "Segunda compra agregada con ID: $COMPRA2_ID"
  
  export COMPRA1_ID COMPRA2_ID
}

# TEST 6: Agregar items a lista de feria y marcar checkbox
test_feria() {
  test_name "Botón/Checkbox: Agregar Producto a Feria y Marcar Comprado"
  
  SEMANA=$(date +%G-W%V)
  
  info "Agregando producto 1: Manzanas ($5)"
  FERIA1=$(curl -s -X POST "$API_URL/lista-semanal" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"semana\": \"$SEMANA\", \"producto\": \"Manzanas\", \"precio_estimado\": 5}")
  
  FERIA1_ID=$(echo "$FERIA1" | jq -r '.id // empty')
  [[ -z "$FERIA1_ID" ]] && error "No se pudo agregar producto a feria. Respuesta: $FERIA1"
  success "Producto 1 agregado con ID: $FERIA1_ID"
  
  info "Agregando producto 2: Lechuga ($2.50)"
  FERIA2=$(curl -s -X POST "$API_URL/lista-semanal" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"semana\": \"$SEMANA\", \"producto\": \"Lechuga\", \"precio_estimado\": 2.50}")
  
  FERIA2_ID=$(echo "$FERIA2" | jq -r '.id // empty')
  [[ -z "$FERIA2_ID" ]] && error "No se pudo agregar segundo producto. Respuesta: $FERIA2"
  success "Producto 2 agregado con ID: $FERIA2_ID"
  
  info "Marcando FERIA1 como comprado (checkbox)"
  MARCAR=$(curl -s -X PUT "$API_URL/lista-semanal/$FERIA1_ID/marcar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"comprado": true}')
  
  [[ -z "$(echo "$MARCAR" | jq -r '.ok // empty')" ]] && error "No se pudo marcar como comprado. Respuesta: $MARCAR"
  success "Producto marcado como comprado"
  
  # Verificar
  FERIA_CHECK=$(curl -s "$API_URL/lista-semanal?semana=$SEMANA" \
    -H "Authorization: Bearer $TOKEN" | jq ".[] | select(.id == $FERIA1_ID) | .comprado")
  
  [[ "$FERIA_CHECK" != "1" ]] && error "No se marcó correctamente. Valor: $FERIA_CHECK"
  success "Verificado: producto marcado como comprado"
  
  export FERIA1_ID FERIA2_ID
}

# TEST 7: Ahorro para vacaciones
test_ahorro() {
  test_name "Botón: Agregar Aporte a Ahorro y Guardar Meta"
  
  MES=$(date +%Y-%m)
  
  info "Registrando aporte de ahorro: \$500 para $MES"
  APORTE=$(curl -s -X POST "$API_URL/ahorro/aporte" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"mes\": \"$MES\", \"monto\": 500, \"nota\": \"Ahorro vacaciones\"}")
  
  APORTE_ID=$(echo "$APORTE" | jq -r '.id // empty')
  [[ -z "$APORTE_ID" ]] && error "No se pudo registrar aporte. Respuesta: $APORTE"
  success "Aporte registrado con ID: $APORTE_ID"
  
  info "Guardando meta de vacaciones: \$5000"
  META=$(curl -s -X PUT "$API_URL/ahorro/meta" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"meta": 5000}')
  
  [[ -z "$(echo "$META" | jq -r '.ok // empty')" ]] && error "No se pudo guardar meta. Respuesta: $META"
  success "Meta guardada: \$5000"
  
  # Obtener resumen de ahorro
  AHORRO_RESUMEN=$(curl -s "$API_URL/ahorro" \
    -H "Authorization: Bearer $TOKEN")
  
  ACUMULADO=$(echo "$AHORRO_RESUMEN" | jq '.acumulado')
  META_ACTUAL=$(echo "$AHORRO_RESUMEN" | jq '.meta')
  
  success "Ahorro acumulado: \$$ACUMULADO, Meta: \$$META_ACTUAL"
}

# TEST 8: Eliminar (borrar botón 🗑)
test_eliminar() {
  test_name "Botón: Eliminar Compra y Producto"
  
  info "Eliminando compra $COMPRA1_ID (Laptop)"
  ELIMINAR_COMPRA=$(curl -s -X DELETE "$API_URL/compras/$COMPRA1_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  [[ -z "$(echo "$ELIMINAR_COMPRA" | jq -r '.ok // empty')" ]] && error "No se pudo eliminar compra. Respuesta: $ELIMINAR_COMPRA"
  success "Compra eliminada"
  
  info "Eliminando persona $PERSONA2_ID (María)"
  ELIMINAR_PERSONA=$(curl -s -X DELETE "$API_URL/personas/$PERSONA2_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  [[ -z "$(echo "$ELIMINAR_PERSONA" | jq -r '.ok // empty')" ]] && error "No se pudo eliminar persona. Respuesta: $ELIMINAR_PERSONA"
  success "Persona eliminada"
  
  info "Eliminando producto de feria $FERIA2_ID (Lechuga)"
  ELIMINAR_FERIA=$(curl -s -X DELETE "$API_URL/lista-semanal/$FERIA2_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  [[ -z "$(echo "$ELIMINAR_FERIA" | jq -r '.ok // empty')" ]] && error "No se pudo eliminar producto. Respuesta: $ELIMINAR_FERIA"
  success "Producto de feria eliminado"
}

# TEST 9: Dashboard/Resumen
test_resumen() {
  test_name "Dashboard: Obtener Resumen"
  
  info "Obteniendo resumen del mes"
  RESUMEN=$(curl -s "$API_URL/resumen" \
    -H "Authorization: Bearer $TOKEN")
  
  TOTAL_SALARIOS=$(echo "$RESUMEN" | jq '.totalSalarios')
  TOTAL_GASTOS=$(echo "$RESUMEN" | jq '.totalGastosFijos')
  AHORRO_SUGERIDO=$(echo "$RESUMEN" | jq '.ahorroSugerido10')
  SALDO=$(echo "$RESUMEN" | jq '.saldoDisponible')
  
  [[ -z "$TOTAL_SALARIOS" ]] && error "No se pudo obtener resumen. Respuesta: $RESUMEN"
  
  success "Resumen obtenido:"
  echo "  • Total Salarios: \$$TOTAL_SALARIOS"
  echo "  • Total Gastos Fijos: \$$TOTAL_GASTOS"
  echo "  • Ahorro Sugerido (10%): \$$AHORRO_SUGERIDO"
  echo "  • Saldo Disponible: \$$SALDO"
}

# MAIN
main() {
  echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║  PRUEBAS E2E - GASTOS DEL HOGAR       ║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
  
  check_api
  test_auth
  test_personas
  test_gastos_fijos
  test_cambiar_estado_gasto
  test_compras
  test_feria
  test_ahorro
  test_eliminar
  test_resumen
  
  echo -e "\n${BOLD}${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║  ✓ TODAS LAS PRUEBAS EXITOSAS          ║${NC}"
  echo -e "${BOLD}${GREEN}╚════════════════════════════════════════╝${NC}\n"
}

main "$@"
