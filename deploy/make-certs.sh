#!/usr/bin/env bash
# Creates the AICS internal root CA (once) and a server certificate for
#   aics.vigan.internal, portal.aics.vigan.internal and the server's IPs
#   (internal 172.22.50.12 and public 103.72.59.246 by default).
#
# Different IPs:  AICS_CERT_IPS="172.22.50.12 103.72.59.246" bash deploy/make-certs.sh
# The root CA only vouches for the IPs it was created with. If the IPs change,
# delete deploy/ca and deploy/certs, re-run, and reinstall the root CA on devices.
#
# Run on the server from the repo root:   bash deploy/make-certs.sh
# Re-run to renew the server certificate; the root CA is kept and reused,
# so office PCs do not need to install anything again.
#
# Output:
#   deploy/ca/aics-root-ca.key    root CA private key. Never copy this anywhere.
#   deploy/certs/aics-root-ca.crt root CA certificate. Install this on every device
#                                 that opens AICS, including outside users' devices.
#   deploy/certs/aics.crt/.key    server certificate used by the proxy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CA_DIR="$ROOT/ca"
CERT_DIR="$ROOT/certs"
DOMAINS=(aics.vigan.internal portal.aics.vigan.internal)
read -r -a IPS <<< "${AICS_CERT_IPS:-172.22.50.12 103.72.59.246}"
SERVER_DAYS=825

mkdir -p "$CA_DIR" "$CERT_DIR"
chmod 700 "$CA_DIR"

if [ ! -f "$CA_DIR/aics-root-ca.key" ]; then
  echo "Creating the AICS root CA..."
  openssl genrsa -out "$CA_DIR/aics-root-ca.key" 4096
  # nameConstraints: this CA can only vouch for *.vigan.internal names and the
  # listed server IPs, so even if its key leaked it could not be used to
  # impersonate any other website.
  CONSTRAINTS="permitted;DNS:vigan.internal"
  for ip in "${IPS[@]}"; do CONSTRAINTS="$CONSTRAINTS,permitted;IP:$ip/255.255.255.255"; done
  openssl req -x509 -new -key "$CA_DIR/aics-root-ca.key" -sha256 -days 3650 \
    -subj "/O=City Government of Vigan/CN=Vigan AICS Internal Root CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "nameConstraints=critical,$CONSTRAINTS" \
    -out "$CERT_DIR/aics-root-ca.crt"
else
  echo "Reusing the existing AICS root CA."
fi

SAN=$(printf 'DNS:%s,' "${DOMAINS[@]}")$(printf 'IP:%s,' "${IPS[@]}"); SAN=${SAN%,}
EXT=$(mktemp)
trap 'rm -f "$EXT" "$CERT_DIR/aics.csr"' EXIT
cat > "$EXT" <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$SAN
EOF

echo "Creating the server certificate for: ${DOMAINS[*]} ${IPS[*]}"
openssl genrsa -out "$CERT_DIR/aics.key" 2048
openssl req -new -key "$CERT_DIR/aics.key" -subj "/CN=${DOMAINS[0]}" -out "$CERT_DIR/aics.csr"
openssl x509 -req -in "$CERT_DIR/aics.csr" \
  -CA "$CERT_DIR/aics-root-ca.crt" -CAkey "$CA_DIR/aics-root-ca.key" -CAcreateserial \
  -days "$SERVER_DAYS" -sha256 -extfile "$EXT" -out "$CERT_DIR/aics.crt"
rm -f "$CERT_DIR/aics-root-ca.srl"

chmod 600 "$CA_DIR/aics-root-ca.key"
chmod 644 "$CERT_DIR/aics.crt" "$CERT_DIR/aics-root-ca.crt"
chmod 600 "$CERT_DIR/aics.key"

echo
openssl x509 -in "$CERT_DIR/aics.crt" -noout -subject -enddate -ext subjectAltName
echo
echo "Done. Restart the proxy to load it:"
echo "  sudo docker compose --env-file .env.production -f docker-compose.production.yml restart proxy"
