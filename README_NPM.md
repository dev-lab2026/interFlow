# Nginx Proxy Manager

Nginx Proxy Manager must be connected to the external Docker network `shared_network`.

Proxy Host settings:
- Scheme: `http`
- Forward Hostname/IP: `interflow`
- Forward Port: `3003`

The application is published locally on `3003` for direct testing. Caddy is not used.
