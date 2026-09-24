#include "static_files.h"
#include "app_paths.h"
#include "http_response.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void serve_static(SOCKET fd, const char *urlPath) {
    char path[1024];
    if (!strcmp(urlPath, "/")) {
        snprintf(path, sizeof path, "%s/index.html", app_web_root());
    } else {
        snprintf(path, sizeof path, "%s%s", app_web_root(), urlPath);
    }

    if (strstr(path, "..")) {
        send_raw(fd, "403 Forbidden", "text/plain", "Forbidden", 9);
        return;
    }

    FILE *file = fopen(path, "rb");
    if (!file) {
        const char *notFound = "<h1>404</h1><p>Arquivo nao encontrado. <a href=\"/index.html\">Voltar ao inicio</a></p>";
        send_raw(fd, "404 Not Found", "text/html; charset=utf-8", notFound, strlen(notFound));
        return;
    }

    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    fseek(file, 0, SEEK_SET);

    char *buffer = (char *)malloc(size ? (size_t)size : 1);
    size_t bytesRead = fread(buffer, 1, (size_t)size, file);
    fclose(file);

    send_raw(fd, "200 OK", mime_of(path), buffer, bytesRead);
    free(buffer);
}
