#ifndef FLUXY_HTTP_RESPONSE_H
#define FLUXY_HTTP_RESPONSE_H

#include <stddef.h>
#include "platform.h"

void send_raw(SOCKET fd, const char *status, const char *contentType, const char *body, size_t len);
void send_json(SOCKET fd, const char *status, const char *json);
void send_error(SOCKET fd, const char *status, const char *code, const char *message);

const char *mime_of(const char *path);

#endif
