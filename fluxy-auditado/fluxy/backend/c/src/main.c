#include "app_paths.h"
#include "platform.h"
#include "routes.h"
#include "sha256.h"
#include "static_files.h"
#include "user_store.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_REQUEST_BYTES (1024 * 512)

static void handle_client(SOCKET fd) {
    char *request = (char *)malloc(MAX_REQUEST_BYTES);
    if (!request) {
        CLOSESOCK(fd);
        return;
    }

    size_t total = 0;
    int received;

    while (total < MAX_REQUEST_BYTES - 1) {
        received = recv(fd, request + total, (int)(MAX_REQUEST_BYTES - 1 - total), 0);
        if (received <= 0) break;
        total += received;
        request[total] = 0;
        if (strstr(request, "\r\n\r\n")) break;
    }

    if (total == 0) {
        free(request);
        CLOSESOCK(fd);
        return;
    }
    request[total] = 0;

    char method[16] = {0};
    char path[1024] = {0};
    sscanf(request, "%15s %1023s", method, path);

    char *queryString = strchr(path, '?');
    if (queryString) *queryString = 0;

    char *body = strstr(request, "\r\n\r\n");
    size_t headerLength = 0;
    if (body) {
        headerLength = (size_t)(body - request) + 4;
        body += 4;
    } else {
        body = request + total;
    }

    const char *contentLengthHeader = strstr(request, "Content-Length:");
    if (!contentLengthHeader) contentLengthHeader = strstr(request, "content-length:");
    if (contentLengthHeader) {
        long wanted = atol(contentLengthHeader + strlen("Content-Length:"));
        long have = (long)(total - headerLength);
        while (have < wanted && total < MAX_REQUEST_BYTES - 1) {
            received = recv(fd, request + total, (int)(MAX_REQUEST_BYTES - 1 - total), 0);
            if (received <= 0) break;
            total += received;
            have += received;
            request[total] = 0;
        }
        body = request + headerLength;
    }

    if (!strncmp(path, "/api/", 5) || !strcmp(path, "/health")) {
        handle_api(fd, method, path, request, body);
    } else {
        serve_static(fd, path);
    }

    free(request);
    CLOSESOCK(fd);
}

int main(int argc, char **argv) {
    app_paths_init(argc, argv);

    srand((unsigned)time(NULL));
    user_store_load();

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket == INVALID_SOCKET) {
        fprintf(stderr, "[Fluxy-C] falha ao criar socket\n");
        return 1;
    }

    int reuseAddr = 1;
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, (const char *)&reuseAddr, sizeof reuseAddr);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons((unsigned short)app_port());

    if (bind(serverSocket, (struct sockaddr *)&addr, sizeof addr) != 0) {
        fprintf(stderr, "[Fluxy-C] a porta %d ja esta em uso.\n", app_port());
        return 1;
    }

    listen(serverSocket, 16);

    printf("[Fluxy-C] API em C ONLINE\n");
    printf("[Fluxy-C] site ......: http://localhost:%d/index.html\n", app_port());
    printf("[Fluxy-C] banco .....: %s (%d usuarios)\n", app_db_path(), user_store_count());
    printf("[Fluxy-C] encerrar ..: Ctrl+C\n");
    fflush(stdout);

    for (;;) {
        struct sockaddr_in clientAddr;
        socklen_t clientLen = sizeof clientAddr;
        SOCKET clientFd = accept(serverSocket, (struct sockaddr *)&clientAddr, &clientLen);
        if (clientFd == INVALID_SOCKET) continue;
        handle_client(clientFd);
    }
}
