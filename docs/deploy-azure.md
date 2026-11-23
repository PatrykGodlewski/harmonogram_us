# Deploying to Azure (one server, Terraform)

Production runs on one small Azure VM with Docker (`deploy/compose.yml`: Caddy for HTTPS, web, admin, worker, documents) and a managed Azure Database for PostgreSQL. Images are built by GitHub Actions (`.github/workflows/images.yml`) and pulled by the server; nothing is built there (the free VM sizes have ~1 GB of memory). Files go to Cloudflare R2, e-mail to any SMTP provider.

Infrastructure is code in `infra/azure` (Terraform, azurerm 4): resource group, network with a static public IP and DNS name (`<dns_label>.<region>.cloudapp.azure.com`), firewall (SSH from your IP; 80, 443, 8443 from anywhere), Ubuntu 24.04 VM (cloud-init installs Docker and 2 GB swap), PostgreSQL Flexible Server (B1ms, 32 GB, 7-day backups) reachable only from the VM. The public site is `https://<fqdn>`, the admin panel `https://<fqdn>:8443` (its own origin, as `ADMIN_URL` requires); with your own domain, point two names at the IP and change `WEB_HOST`/`Caddyfile`.

Azure for Students: the subscription must be **active** (`az account show --query state`), and resources may only be created in `swedencentral`, `germanywestcentral`, `italynorth`, `spaincentral` or `uaenorth` (policy on the subscription). The VM size (`Standard_B2ats_v2`) and the database size (`B_Standard_B1ms`) are within the student free allowance; the static public IP and anything above the free amounts use the credit.

## First deployment

```bash
# Tools and sign-in
sudo pacman -S terraform azure-cli     # or your OS's packages
az login
ssh-keygen -t ed25519 -f ~/.ssh/harmonogram_azure -C harmonogram-azure

# Infrastructure
cp infra/azure/terraform.tfvars.example infra/azure/terraform.tfvars   # subscription, dns_label, your IP/32
terraform -chdir=infra/azure init
terraform -chdir=infra/azure plan -out=main.tfplan
terraform -chdir=infra/azure apply main.tfplan

# Images: set the repository variable VITE_TURNSTILE_SITE_KEY (public site key), then
# push to main/next or run the "images" workflow; make the four ghcr.io packages public
# (GitHub → Packages → package settings) so the server can pull without a token.

# Settings and start
cp deploy/.env.production.example deploy/.env.production   # fill in; DATABASE_URL from:
terraform -chdir=infra/azure output -raw database_url
deploy/deploy.sh
```

`deploy/deploy.sh` copies `compose.yml`, `Caddyfile` and the settings (as `.env`, mode 600) to `/opt/harmonogram`, pulls the images and starts them; `migrate` applies database migrations before the apps start.

## Updates

Push to the branch in `TAG` (images rebuild), then run `deploy/deploy.sh` again. Logs: `ssh … 'cd /opt/harmonogram && docker compose logs -f web'`.

## Removing everything

`terraform -chdir=infra/azure destroy` deletes the server, the database (with its data and backups) and the network.
