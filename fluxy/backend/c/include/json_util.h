#ifndef FLUXY_JSON_UTIL_H
#define FLUXY_JSON_UTIL_H

#include <stddef.h>

int json_get(const char *body, const char *key, char *out, size_t size);

void json_escape(const char *in, char *out, size_t size);

#endif
