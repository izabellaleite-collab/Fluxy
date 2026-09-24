#include "http_response.h"
#include "json_util.h"

#include <stdio.h>
#include <string.h>

void send_raw(SOCKET fd, const char *status, const char *contentType, const char *body, size_t len) {
    char head[512];
    int n = snprintf(head, sizeof head,
        "HTTP/1.1 %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Cache-Control: no-store\r\n"
        "Connection: close\r\n\r\n",
        status, contentType, len);

    send(fd, head, n, 0);
    if (len) send(fd, body, (int)len, 0);
}

void send_json(SOCKET fd, const char *status, const char *json) {
    send_raw(fd, status, "application/json; charset=utf-8", json, strlen(json));
}

void send_error(SOCKET fd, const char *status, const char *code, const char *message) {
    char buf[512], escaped[300];
    json_escape(message, escaped, sizeof escaped);
    snprintf(buf, sizeof buf, "{\"error\":\"%s\",\"message\":\"%s\"}", code, escaped);
    send_json(fd, status, buf);
}

const char *mime_of(const char *path) {
    const char *dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";

    if (!strcmp(dot, ".html")) return "text/html; charset=utf-8";
    if (!strcmp(dot, ".js"))   return "text/javascript; charset=utf-8";
    if (!strcmp(dot, ".css"))  return "text/css; charset=utf-8";
    if (!strcmp(dot, ".json")) return "application/json; charset=utf-8";
    if (!strcmp(dot, ".png"))  return "image/png";
    if (!strcmp(dot, ".jpg") || !strcmp(dot, ".jpeg")) return "image/jpeg";
    if (!strcmp(dot, ".svg"))  return "image/svg+xml";
    if (!strcmp(dot, ".ico"))  return "image/x-icon";

    return "application/octet-stream";
}
