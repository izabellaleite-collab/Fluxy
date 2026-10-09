#include "routes.h"
#include "app_paths.h"
#include "http_response.h"
#include "json_util.h"
#include "session_store.h"
#include "sha256.h"
#include "user_store.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

#define MAX_COMPANY_JSON_BYTES 4000

static void lower_str(char *s) {
    for (; *s; s++) {
        if (*s >= 'A' && *s <= 'Z') *s += 32;
    }
}

static int valid_email(const char *email) {
    const char *at = strchr(email, '@');
    if (!at || at == email) return 0;
    const char *dot = strchr(at, '.');
    return dot && dot[1];
}

static int strong_password(const char *password) {
    int upper = 0, lower = 0, digit = 0;
    size_t length = strlen(password);
    for (const char *c = password; *c; c++) {
        if (*c >= 'A' && *c <= 'Z') upper = 1;
        else if (*c >= 'a' && *c <= 'z') lower = 1;
        else if (*c >= '0' && *c <= '9') digit = 1;
    }
    return length >= 8 && upper && lower && digit;
}

static const char *now_iso(void) {
    static char out[32];
    time_t t = time(NULL);
    struct tm *g = gmtime(&t);
    strftime(out, sizeof out, "%Y-%m-%dT%H:%M:%SZ", g);
    return out;
}

static void route_health(SOCKET fd) {
    char out[128];
    snprintf(out, sizeof out, "{\"status\":\"ok\",\"engine\":\"c\",\"database\":\"connected\",\"users\":%d}", user_store_count());
    send_json(fd, "200 OK", out);
}

static void route_register(SOCKET fd, const char *body) {
    char name[128], email[160], password[128], phone[40], cpf[40];
    json_get(body, "name", name, sizeof name);
    json_get(body, "email", email, sizeof email);
    json_get(body, "password", password, sizeof password);
    json_get(body, "phone", phone, sizeof phone);
    json_get(body, "cpf", cpf, sizeof cpf);
    lower_str(email);

    if (!name[0] || !valid_email(email)) {
        send_error(fd, "400 Bad Request", "invalid_request", "Informe nome e um e-mail valido.");
        return;
    }
    if (!strong_password(password)) {
        send_error(fd, "400 Bad Request", "weak_password", "A senha precisa de 8 caracteres, com letra maiuscula, minuscula e numero.");
        return;
    }
    if (user_store_find_by_email(email)) {
        send_error(fd, "409 Conflict", "email_already_exists", "Este e-mail ja esta cadastrado.");
        return;
    }

    User newUser;
    memset(&newUser, 0, sizeof newUser);
    newUser.id = user_store_next_id();
    snprintf(newUser.name, sizeof newUser.name, "%s", name);
    snprintf(newUser.email, sizeof newUser.email, "%s", email);
    snprintf(newUser.phone, sizeof newUser.phone, "%s", phone);
    snprintf(newUser.cpf, sizeof newUser.cpf, "%s", cpf);
    random_hex(newUser.salt, 16);
    slow_hash(newUser.salt, password, newUser.hash);
    snprintf(newUser.created, sizeof newUser.created, "%s", now_iso());

    User *stored = user_store_add(&newUser);
    if (!stored) {
        send_error(fd, "500 Internal Server Error", "full", "Limite de usuarios atingido.");
        return;
    }
    user_store_save();

    char token[49];
    session_create(stored->id, token);

    char escName[300], escEmail[300], out[2048];
    json_escape(stored->name, escName, sizeof escName);
    json_escape(stored->email, escEmail, sizeof escEmail);
    snprintf(out, sizeof out, "{\"id\":%d,\"name\":\"%s\",\"email\":\"%s\",\"role\":\"admin\",\"token\":\"%s\"}",
             stored->id, escName, escEmail, token);

    printf("[Fluxy-C] register_success id=%d\n", stored->id);
    fflush(stdout);
    send_json(fd, "201 Created", out);
}

static void route_login(SOCKET fd, const char *body) {
    char email[160], password[128], calculatedHash[65];
    json_get(body, "email", email, sizeof email);
    json_get(body, "password", password, sizeof password);
    lower_str(email);

    User *user = user_store_find_by_email(email);
    if (!user) {
        send_error(fd, "401 Unauthorized", "invalid_credentials", "E-mail ou senha invalidos.");
        return;
    }

    slow_hash(user->salt, password, calculatedHash);
    if (strcmp(calculatedHash, user->hash) != 0) {
        send_error(fd, "401 Unauthorized", "invalid_credentials", "E-mail ou senha invalidos.");
        return;
    }

    char token[49];
    session_create(user->id, token);

    char escName[300], escEmail[300], out[2048];
    json_escape(user->name, escName, sizeof escName);
    json_escape(user->email, escEmail, sizeof escEmail);
    snprintf(out, sizeof out, "{\"user_id\":%d,\"name\":\"%s\",\"email\":\"%s\",\"phone\":\"%s\",\"role\":\"admin\",\"token\":\"%s\"}",
             user->id, escName, escEmail, user->phone, token);

    printf("[Fluxy-C] login_success id=%d\n", user->id);
    fflush(stdout);
    send_json(fd, "200 OK", out);
}

static void route_logout(SOCKET fd, const char *headers) {
    int userId = session_user_id_from_auth_header(headers);
    if (userId) session_invalidate_all_for_user(userId);
    send_json(fd, "200 OK", "{\"ok\":true}");
}

static void route_me(SOCKET fd, const char *headers) {
    int userId = session_user_id_from_auth_header(headers);
    User *user = userId ? user_store_find_by_id(userId) : NULL;
    if (!user) {
        send_error(fd, "401 Unauthorized", "unauthorized", "Sessao expirada.");
        return;
    }

    char escName[300], escEmail[300], out[1024];
    json_escape(user->name, escName, sizeof escName);
    json_escape(user->email, escEmail, sizeof escEmail);
    snprintf(out, sizeof out, "{\"id\":%d,\"name\":\"%s\",\"email\":\"%s\",\"role\":\"admin\"}", user->id, escName, escEmail);
    send_json(fd, "200 OK", out);
}

/* A versao em C nao envia e-mail; a recuperacao de senha existe apenas no backend Node. */
static void route_password_recovery_unavailable(SOCKET fd) {
    send_error(fd, "501 Not Implemented", "email_not_configured",
               "A recuperacao de senha por e-mail so existe no servidor Node do Fluxy (npm start).");
}

static void route_security_question_retired(SOCKET fd) {
    send_error(fd, "410 Gone", "security_question_retired",
               "A recuperacao por pergunta de seguranca foi desativada.");
}

static void route_company(SOCKET fd, const char *method, const char *headers, const char *body) {
    if (!session_user_id_from_auth_header(headers)) {
        send_error(fd, "401 Unauthorized", "unauthorized", "Sessao expirada.");
        return;
    }

    if (!strcmp(method, "POST")) {
        size_t length = strlen(body);
        if (length < 2 || length > MAX_COMPANY_JSON_BYTES || body[0] != '{' || body[length - 1] != '}') {
            send_error(fd, "400 Bad Request", "invalid_request", "Dados da empresa invalidos.");
            return;
        }
        FILE *file = fopen(app_company_path(), "w");
        if (!file) {
            send_error(fd, "500 Internal Server Error", "internal_error", "Nao foi possivel salvar.");
            return;
        }
        fputs(body, file);
        fclose(file);
        send_json(fd, "200 OK", "{\"ok\":true}");
        return;
    }

    char buf[MAX_COMPANY_JSON_BYTES + 1];
    size_t n = 0;
    FILE *file = fopen(app_company_path(), "r");
    if (file) {
        n = fread(buf, 1, sizeof buf - 1, file);
        fclose(file);
    }
    buf[n] = 0;

    char wrapped[MAX_COMPANY_JSON_BYTES + 32];
    snprintf(wrapped, sizeof wrapped, "{\"company\":%s}", n ? buf : "null");
    send_json(fd, "200 OK", wrapped);
}

void handle_api(SOCKET fd, const char *method, const char *path, const char *headers, const char *body) {
    if (!strcmp(method, "OPTIONS")) {
        send_json(fd, "204 No Content", "{}");
        return;
    }

    if (!strcmp(path, "/health") || !strcmp(path, "/api/health")) {
        route_health(fd);
        return;
    }
    if (!strcmp(path, "/api/auth/register") && !strcmp(method, "POST")) {
        route_register(fd, body);
        return;
    }
    if (!strcmp(path, "/api/auth/login") && !strcmp(method, "POST")) {
        route_login(fd, body);
        return;
    }
    if (!strcmp(path, "/api/auth/logout") && !strcmp(method, "POST")) {
        route_logout(fd, headers);
        return;
    }
    if (!strcmp(path, "/api/me")) {
        route_me(fd, headers);
        return;
    }
    if (!strcmp(path, "/api/auth/forgot-password") || !strncmp(path, "/api/auth/reset-password", 24)) {
        route_password_recovery_unavailable(fd);
        return;
    }
    if (!strcmp(path, "/api/auth/answer-question")) {
        route_security_question_retired(fd);
        return;
    }
    if (!strcmp(path, "/api/company")) {
        route_company(fd, method, headers, body);
        return;
    }

    send_error(fd, "404 Not Found", "not_found", "Rota nao encontrada.");
}
