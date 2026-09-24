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

static void normalize_answer(char *s) {
    lower_str(s);

    size_t w = 0;
    int inSpace = 0;
    for (size_t r = 0; s[r]; r++) {
        char c = (s[r] == '\t' || s[r] == '\n') ? ' ' : s[r];
        if (c == ' ') {
            if (inSpace) continue;
            inSpace = 1;
        } else {
            inSpace = 0;
        }
        s[w++] = c;
    }
    s[w] = 0;

    size_t n = strlen(s);
    while (n && s[n - 1] == ' ') s[--n] = 0;

    size_t i = 0;
    while (s[i] == ' ') i++;
    if (i) memmove(s, s + i, strlen(s + i) + 1);
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
    char name[128], email[160], password[128], phone[40], cpf[40], question[200], answer[200];
    json_get(body, "name", name, sizeof name);
    json_get(body, "email", email, sizeof email);
    json_get(body, "password", password, sizeof password);
    json_get(body, "phone", phone, sizeof phone);
    json_get(body, "cpf", cpf, sizeof cpf);
    json_get(body, "securityQuestion", question, sizeof question);
    json_get(body, "securityAnswer", answer, sizeof answer);
    lower_str(email);

    if (!name[0] || !valid_email(email) || strlen(password) < 8) {
        send_error(fd, "400 Bad Request", "invalid_request", "Informe nome, e-mail valido e senha com ao menos 8 caracteres.");
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
    if (question[0] && answer[0]) {
        snprintf(newUser.question, sizeof newUser.question, "%s", question);
        normalize_answer(answer);
        random_hex(newUser.asalt, 16);
        slow_hash(newUser.asalt, answer, newUser.ahash);
    }
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

    printf("[Fluxy-C] register_success id=%d email=%s\n", stored->id, stored->email);
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

static void route_forgot_password(SOCKET fd, const char *body) {
    char email[160];
    json_get(body, "email", email, sizeof email);
    lower_str(email);

    User *user = user_store_find_by_email(email);
    if (!user) {
        send_json(fd, "200 OK", "{\"question\":\"\"}");
        return;
    }

    char escQuestion[300], out[400];
    json_escape(user->question, escQuestion, sizeof escQuestion);
    snprintf(out, sizeof out, "{\"question\":\"%s\"}", escQuestion);
    send_json(fd, "200 OK", out);
}

static void route_answer_question(SOCKET fd, const char *body) {
    char email[160], answer[200], calculatedHash[65];
    json_get(body, "email", email, sizeof email);
    json_get(body, "answer", answer, sizeof answer);
    lower_str(email);

    User *user = user_store_find_by_email(email);
    if (!user || !user->ahash[0] || !strcmp(user->ahash, "-")) {
        send_error(fd, "400 Bad Request", "no_question", "Nenhuma pergunta de seguranca cadastrada.");
        return;
    }

    normalize_answer(answer);
    slow_hash(user->asalt, answer, calculatedHash);
    if (strcmp(calculatedHash, user->ahash) != 0) {
        send_error(fd, "401 Unauthorized", "wrong_answer", "Resposta incorreta.");
        return;
    }

    char token[49];
    reset_token_create(user->id, 900, token);

    char out[128];
    snprintf(out, sizeof out, "{\"token\":\"%s\"}", token);
    send_json(fd, "200 OK", out);
}

static void route_reset_password(SOCKET fd, const char *body) {
    char token[64], password[128];
    json_get(body, "token", token, sizeof token);
    json_get(body, "password", password, sizeof password);

    if (strlen(password) < 8) {
        send_error(fd, "400 Bad Request", "weak_password", "A nova senha precisa de ao menos 8 caracteres.");
        return;
    }

    int userId = reset_token_user_id(token);
    User *user = userId ? user_store_find_by_id(userId) : NULL;
    if (!user) {
        send_error(fd, "400 Bad Request", "invalid_token", "Link de redefinicao invalido ou expirado.");
        return;
    }

    random_hex(user->salt, 16);
    slow_hash(user->salt, password, user->hash);
    reset_token_mark_used(token);
    session_invalidate_all_for_user(user->id);
    user_store_save();

    printf("[Fluxy-C] password_reset id=%d\n", user->id);
    fflush(stdout);
    send_json(fd, "200 OK", "{\"ok\":true}");
}

static void route_company(SOCKET fd, const char *method, const char *body) {
    if (!strcmp(method, "POST")) {
        FILE *file = fopen(app_company_path(), "w");
        if (file) {
            fputs(body, file);
            fclose(file);
        }
        send_json(fd, "200 OK", "{\"ok\":true}");
        return;
    }

    FILE *file = fopen(app_company_path(), "r");
    if (!file) {
        send_json(fd, "200 OK", "{\"company\":null}");
        return;
    }

    char buf[4096];
    size_t n = fread(buf, 1, sizeof buf - 1, file);
    buf[n] = 0;
    fclose(file);

    char wrapped[4200];
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
    if (!strcmp(path, "/api/auth/forgot-password") && !strcmp(method, "POST")) {
        route_forgot_password(fd, body);
        return;
    }
    if (!strcmp(path, "/api/auth/answer-question") && !strcmp(method, "POST")) {
        route_answer_question(fd, body);
        return;
    }
    if (!strcmp(path, "/api/auth/reset-password") && !strcmp(method, "POST")) {
        route_reset_password(fd, body);
        return;
    }
    if (!strcmp(path, "/api/company")) {
        route_company(fd, method, body);
        return;
    }

    send_error(fd, "404 Not Found", "not_found", "Rota nao encontrada.");
}
