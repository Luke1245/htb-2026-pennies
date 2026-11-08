#!/bin/sh
set -eu

conf=/etc/nginx/conf.d/default.conf
domain="${SITE_ADDRESS:-}"
cert="/etc/letsencrypt/live/${domain}/fullchain.pem"

mkdir -p /var/www/certbot /etc/letsencrypt /var/cache/nginx /var/run

write_http() {
    cat > "$conf" << 'EOF'
server {
    listen 80;
    server_name _;
    server_tokens off;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 1m;

    resolver 127.0.0.11 valid=10s ipv6=off;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
    }

    include /etc/nginx/app-locations.conf;
}
EOF
}

write_https() {
    cat > "$conf" << EOF
server {
    listen 80;
    server_name ${domain};
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 80;
    server_name 192.248.175.175;
    return 301 https://${domain}\$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${domain};
    server_tokens off;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 1m;

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    resolver 127.0.0.11 valid=10s ipv6=off;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    include /etc/nginx/app-locations.conf;
}
EOF
}

if [ -z "$domain" ] || [ "$domain" = ":80" ]; then
    write_http
    exec nginx -g 'daemon off;'
fi

if [ ! -s "$cert" ]; then
    write_http
    nginx -g 'daemon off;' &
    nginx_pid=$!
    i=0
    while [ "$i" -lt 20 ]; do
        if wget -q -O /dev/null http://127.0.0.1/; then
            break
        fi
        i=$((i + 1))
        sleep 0.5
    done
    certbot certonly \
        --webroot -w /var/www/certbot \
        --domain "$domain" \
        --agree-tos \
        --non-interactive \
        --register-unsafely-without-email \
        --keep-until-expiring
    write_https
    nginx -s reload
    (
        while true; do
            sleep 12h
            certbot renew --webroot -w /var/www/certbot --quiet && nginx -s reload
        done
    ) &
    renew_pid=$!
    trap 'nginx -s quit; kill "$renew_pid" 2>/dev/null; wait "$nginx_pid"' TERM INT
    wait "$nginx_pid"
    exit
fi

write_https
nginx -g 'daemon off;' &
nginx_pid=$!
(
    while true; do
        sleep 12h
        certbot renew --webroot -w /var/www/certbot --quiet && nginx -s reload
    done
) &
renew_pid=$!
trap 'nginx -s quit; kill "$renew_pid" 2>/dev/null; wait "$nginx_pid"' TERM INT
wait "$nginx_pid"
