# Deploying to Oracle Cloud Always Free (one Arm server, Terraform)

The whole app runs on one Always Free Arm server (2 OCPUs, 12 GB, 100 GB disk): `deploy/compose.yml` with Caddy (HTTPS), web, admin, worker, documents and Postgres on the server itself (profile `local-db`, a compressed dump every day kept 14 days in `/opt/harmonogram/backups`). Images are built for Arm by GitHub Actions (`.github/workflows/images.yml`) and pulled by the server. Files go to Cloudflare R2, e-mail to any SMTP provider.

`infra/oracle` (Terraform, provider `oracle/oci`) creates a VCN with an internet gateway, a public subnet, firewall rules (SSH from your IP; 80, 443, 8443 from anywhere) and a `VM.Standard.A1.Flex` Ubuntu 24.04 server; cloud-init installs Docker and opens the web ports in the host firewall (Oracle's Ubuntu images reject them by default).

Oracle gives no host name, so the server needs one for HTTPS: a free DuckDNS name (`<name>.duckdns.org`) pointed at the server's public IP. The public site is `https://<name>`, the admin panel `https://<name>:8443`.

## First deployment

1. **Account.** Sign up at oracle.com/cloud/free. The **home region is permanent** and Always Free Arm servers exist only there; popular regions (Frankfurt, Amsterdam) often have no free Arm capacity. Upgrading the account to Pay As You Go keeps Always Free resources free and usually makes capacity available; you pay only for what exceeds the free limits.
2. **API key.** Console → Profile → *API keys* → *Add API key* → download the private key to `~/.oci/oci_api_key.pem` (`chmod 600`) and paste the shown configuration into `~/.oci/config` (fix `key_file`). The tenancy OCID in it is the `compartment_ocid`.
3. **Infrastructure.**
   ```bash
   cp infra/oracle/terraform.tfvars.example infra/oracle/terraform.tfvars   # region, tenancy OCID, your IP/32
   terraform -chdir=infra/oracle init
   terraform -chdir=infra/oracle plan -out=main.tfplan
   terraform -chdir=infra/oracle apply main.tfplan
   ```
   "Out of host capacity": set `availability_domain_index = 1` (or 2) and apply again, or retry later.
4. **Name.** At duckdns.org (sign in with GitHub) create a name and set its IP to `terraform -chdir=infra/oracle output -raw public_ip`.
5. **Images.** Set the repository variable `VITE_TURNSTILE_SITE_KEY` (Turnstile site key for your DuckDNS name) and run the *images* workflow (or push).
6. **Settings.** `cp deploy/.env.production.example deploy/.env.production`; set `WEB_HOST`, the URLs, `COMPOSE_PROFILES=local-db`, `POSTGRES_PASSWORD` and the matching `DATABASE_URL`, `NODE_OPTIONS=--max-old-space-size=1024`, and the secrets.
7. **Start.** `deploy/deploy.sh ubuntu@<name>.duckdns.org`

## Updates and backups

Push (images rebuild), then `deploy/deploy.sh ubuntu@<name>.duckdns.org`. Copy backups off the server now and then: `scp -i ~/.ssh/harmonogram_azure 'ubuntu@<name>.duckdns.org:/opt/harmonogram/backups/*' .`

## Removing everything

`terraform -chdir=infra/oracle destroy` deletes the server with its disk (the database and backups on it included).
