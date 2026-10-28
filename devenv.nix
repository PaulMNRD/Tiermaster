{ pkgs, ... }:
{
  # Toolchain: Node 24 + pnpm 12, both pinned by devenv.lock (no nvm or corepack needed).
  languages = {
    javascript = {
      enable = true;
      package = pkgs.nodejs_24;
      pnpm.enable = true;
    };
    typescript = {
      enable = true;
      lsp.enable = true;
    };
  };

  # Needed by Prisma's native engines.
  packages = [ pkgs.openssl ];

  # Non-secret development defaults. Production secrets never live here.
  env = {
    DATABASE_URL = "postgresql://tiermaster:tiermaster@localhost:5432/tiermaster";
    # Garage (S3 API). Fixed development-only credentials, imported in afterStart below.
    S3_ENDPOINT = "http://127.0.0.1:3900";
    S3_REGION = "us-east-1";
    S3_FORCE_PATH_STYLE = "true";
    S3_ACCESS_KEY = "GK1a2b3c4d5e6f1a2b3c4d5e6f";
    S3_SECRET_KEY = "a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718";
    S3_BUCKET = "tiermaster-images";
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines_7}/bin/schema-engine";
    # Development-only sign-in without OAuth credentials (refused by the API in production).
    AUTH_FAKE_ENABLED = "true";
    PUBLIC_URL = "http://localhost:4200";
  };

  # Application processes, started by `devenv up` next to PostgreSQL and Garage.
  processes = {
    api.exec = ''
      until pg_isready -q -h 127.0.0.1 -p 5432; do sleep 1; done
      pnpm install --frozen-lockfile
      pnpm build:shared
      cd services/api
      pnpm exec prisma generate
      pnpm exec prisma migrate deploy
      pnpm start:dev
    '';
    front.exec = ''
      until [ -d services/shared/dist ]; do sleep 1; done
      cd services/front && pnpm start
    '';
  };

  # PostgreSQL: started by `devenv up`.
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_18;
    listen_addresses = "127.0.0.1";
    port = 5432;
    initialDatabases = [ { name = "tiermaster"; } ];
    # SUPERUSER so that `prisma migrate dev` can create its shadow database.
    initialScript = ''
      CREATE ROLE tiermaster WITH SUPERUSER LOGIN PASSWORD 'tiermaster';
    '';
  };

  # Garage (S3-compatible storage): S3 API on :3900, admin API on :3903.
  # devenv applies the single-node cluster layout and creates the buckets itself.
  services.garage = {
    enable = true;
    buckets = [ "tiermaster-images" ];
    # Runs after the layout is applied, on every start: must be safe to re-run.
    afterStart = ''
      garage key import --yes -n tiermaster-dev \
        GK1a2b3c4d5e6f1a2b3c4d5e6f \
        a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718 || true
      garage bucket allow --read --write --owner tiermaster-images --key tiermaster-dev
    '';
  };
}
