#include "static_files.h"
#include "app_paths.h"
#include "http_response.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_STATIC_FILE_BYTES (16L * 1024 * 1024)

void serve_static(SOCKET fd, const char *urlPath) {
    if (strstr(urlPath, "..") || strchr(urlPath, '\\')) {
        send_raw(fd, "403 Forbidden", "text/plain", "Forbidden", 9);
        return;
    }

    char path[1024];
    if (!strcmp(urlPath, "/")) {
        snprintf(path, sizeof path, "%s/index.html", app_web_root());
    } else {
        snprintf(path, sizeof path, "%s%s", app_web_root(), urlPath);
    }

    const char *notFound = "<h1>404</h1><p>Arquivo nao encontrado. <a href=\"/index.html\">Voltar ao inicio</a></p>";

    FILE *file = fopen(path, "rb");
    long size = -1;
    if (file && fseek(file, 0, SEEK_END) == 0) size = ftell(file);

    /* pastas e arquivos ilegiveis caem aqui */
    char *buffer = (size >= 0 && size < MAX_STATIC_FILE_BYTES) ? (char *)malloc(size ? (size_t)size : 1) : NULL;
    if (!buffer) {
        if (file) fclose(file);
        send_raw(fd, "404 Not Found", "text/html; charset=utf-8", notFound, strlen(notFound));
        return;
    }

    fseek(file, 0, SEEK_SET);
    size_t bytesRead = fread(buffer, 1, (size_t)size, file);
    fclose(file);

    send_raw(fd, "200 OK", mime_of(path), buffer, bytesRead);
    free(buffer);
}
