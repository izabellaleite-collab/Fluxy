#ifndef FLUXY_ROUTES_H
#define FLUXY_ROUTES_H

#include "platform.h"

void handle_api(SOCKET fd, const char *method, const char *path, const char *headers, const char *body);

#endif
