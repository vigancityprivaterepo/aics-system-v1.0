ssl_certificate /etc/nginx/certs/aics.crt;
ssl_certificate_key /etc/nginx/certs/aics.key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;

# Same upload ceiling as the app containers (GL uploads, CSV imports, backup restore).
client_max_body_size 320m;
