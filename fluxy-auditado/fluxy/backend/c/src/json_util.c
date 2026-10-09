#include "json_util.h"

#include <string.h>
#include <stdio.h>

int json_get(const char *body, const char *key, char *out, size_t size) {
    char pattern[64];
    snprintf(pattern, sizeof pattern, "\"%s\"", key);

    const char *p = strstr(body, pattern);
    out[0] = 0;
    if (!p) return 0;

    p = strchr(p + strlen(pattern), ':');
    if (!p) return 0;
    p++;

    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    if (*p != '"') return 0;
    p++;

    size_t i = 0;
    while (*p && *p != '"' && i < size - 1) {
        if (*p == '\\' && p[1]) {
            p++;
            char c = *p;
            if (c == 'n' || c == 't' || c == 'r') c = ' ';
            out[i++] = c;
        } else {
            out[i++] = *p;
        }
        p++;
    }
    out[i] = 0;
    return 1;
}

void json_escape(const char *in, char *out, size_t size) {
    size_t i = 0;
    for (; *in && i < size - 7; in++) {
        if (*in == '"' || *in == '\\') {
            out[i++] = '\\';
            out[i++] = *in;
        } else if ((unsigned char)*in < 0x20) {
            i += snprintf(out + i, size - i, "\\u%04x", *in);
        } else {
            out[i++] = *in;
        }
    }
    out[i] = 0;
}
