# Security

- VOICE_TICKET_SECRET signs short-lived voice tokens via HMAC-SHA256
- JWT_SECRET rotated monthly; RS256 upgrade planned for v2
- All secrets sourced from env; never committed to repo
- MongoDB URI uses scoped DB user with write-only permissions
