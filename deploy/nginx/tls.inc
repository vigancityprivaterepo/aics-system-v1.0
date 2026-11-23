ssl_certificate /etc/nginx/certs/aics.crt;
ssl_certificate_key /etc/nginx/certs/aics.key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;

# Plain http:// sent to an HTTPS port (old http://IP:8081 bookmarks): nginx reports
# it as 497; answer with a redirect to the same address over https.
error_page 497 =301 https://$http_host$request_uri;

# Same upload ceiling as the app containers (GL uploads, CSV imports, backup restore).
client_max_body_size 320m;
