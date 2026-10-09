#include "app_paths.h"
#include "platform.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char project_root[480];
static char web_root[512];
static char db_path[576];
static char legacy_db_path[576];
static char company_path[576];
static int port = APP_PORT_DEFAULT;

static void ensure_dir_exists(const char *path) {
    MKDIR(path);
}

static void migrate_legacy_db_if_needed(void) {
    FILE *newFile = fopen(db_path, "r");
    if (newFile) { fclose(newFile); return; }

    FILE *legacy = fopen(legacy_db_path, "r");
    if (!legacy) return;

    FILE *out = fopen(db_path, "w");
    if (!out) { fclose(legacy); return; }

    char buffer[4096];
    size_t bytesRead;
    while ((bytesRead = fread(buffer, 1, sizeof buffer, legacy)) > 0) {
        fwrite(buffer, 1, bytesRead, out);
    }
    fclose(legacy);
    fclose(out);
}

void app_paths_init(int argc, char **argv) {
    const char *envPort = getenv("API_PORT");
    if (envPort) port = atoi(envPort);
    if (argc > 1) port = atoi(argv[1]);
    if (port <= 0) port = APP_PORT_DEFAULT;

    const char *root = getenv("FLUXY_ROOT");
    if (!root) root = getenv("SKINA_ROOT");
    snprintf(project_root, sizeof project_root, "%s", root ? root : "../..");

    snprintf(web_root, sizeof web_root, "%s/frontend", project_root);

    char dataDir[540];
    snprintf(dataDir, sizeof dataDir, "%s/backend/database/data", project_root);
    snprintf(db_path, sizeof db_path, "%s/fluxy-users.db", dataDir);
    snprintf(legacy_db_path, sizeof legacy_db_path, "%s/skina-users.db", dataDir);
    snprintf(company_path, sizeof company_path, "%s/fluxy-company.json", dataDir);

    char backendDir[520];
    snprintf(backendDir, sizeof backendDir, "%s/backend", project_root);
    ensure_dir_exists(backendDir);
    char databaseDir[540];
    snprintf(databaseDir, sizeof databaseDir, "%s/backend/database", project_root);
    ensure_dir_exists(databaseDir);
    ensure_dir_exists(dataDir);

    migrate_legacy_db_if_needed();

#ifdef _WIN32
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#else
    signal(SIGPIPE, SIG_IGN);
#endif
}

const char *app_web_root(void) { return web_root; }
const char *app_db_path(void) { return db_path; }
const char *app_company_path(void) { return company_path; }
int app_port(void) { return port; }
