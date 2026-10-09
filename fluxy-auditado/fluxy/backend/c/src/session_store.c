#include "session_store.h"
#include "sha256.h"

#include <stdio.h>
#include <string.h>

typedef struct {
    char token[49];
    int user_id;
    time_t expires;
    int used;
} TokenEntry;

static TokenEntry sessions[SESSION_STORE_MAX];
static int session_count = 0;

static TokenEntry resets[SESSION_STORE_MAX];
static int reset_count = 0;

void session_create(int userId, char tokenOut[49]) {
    if (session_count >= SESSION_STORE_MAX) session_count = 0;

    random_hex(tokenOut, 24);
    TokenEntry *entry = &sessions[session_count++];
    snprintf(entry->token, sizeof entry->token, "%s", tokenOut);
    entry->user_id = userId;
    entry->expires = time(NULL) + 30L * 24 * 3600;
    entry->used = 0;
}

static const char *find_bearer_token(const char *headers, char tokenOut[49]) {
    const char *p = strstr(headers, "Authorization: Bearer ");
    if (!p) p = strstr(headers, "authorization: Bearer ");
    if (!p) return NULL;

    p += strlen("Authorization: Bearer ");
    size_t i = 0;
    while (p[i] && p[i] != '\r' && p[i] != '\n' && i < 48) {
        tokenOut[i] = p[i];
        i++;
    }
    tokenOut[i] = 0;
    return tokenOut;
}

int session_user_id_from_auth_header(const char *headers) {
    char token[49];
    if (!find_bearer_token(headers, token)) return 0;

    time_t now = time(NULL);
    for (int i = 0; i < session_count; i++) {
        if (!strcmp(sessions[i].token, token) && sessions[i].expires > now) {
            return sessions[i].user_id;
        }
    }
    return 0;
}

void session_invalidate_all_for_user(int userId) {
    for (int i = 0; i < session_count; i++) {
        if (sessions[i].user_id == userId) sessions[i].expires = 0;
    }
}

void reset_token_create(int userId, int ttlSeconds, char tokenOut[49]) {
    if (reset_count >= SESSION_STORE_MAX) reset_count = 0;

    random_hex(tokenOut, 24);
    TokenEntry *entry = &resets[reset_count++];
    snprintf(entry->token, sizeof entry->token, "%s", tokenOut);
    entry->user_id = userId;
    entry->expires = time(NULL) + ttlSeconds;
    entry->used = 0;
}

static TokenEntry *find_valid_reset(const char *token) {
    time_t now = time(NULL);
    for (int i = 0; i < reset_count; i++) {
        if (!resets[i].used && resets[i].expires > now && !strcmp(resets[i].token, token)) {
            return &resets[i];
        }
    }
    return NULL;
}

int reset_token_user_id(const char *token) {
    TokenEntry *entry = find_valid_reset(token);
    return entry ? entry->user_id : 0;
}

void reset_token_mark_used(const char *token) {
    TokenEntry *entry = find_valid_reset(token);
    if (entry) entry->used = 1;
}
