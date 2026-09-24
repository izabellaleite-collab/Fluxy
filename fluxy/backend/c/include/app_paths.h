#ifndef FLUXY_APP_PATHS_H
#define FLUXY_APP_PATHS_H

#define APP_PORT_DEFAULT 8080

void app_paths_init(int argc, char **argv);

const char *app_web_root(void);
const char *app_db_path(void);
const char *app_company_path(void);
int app_port(void);

#endif
