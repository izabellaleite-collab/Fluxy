#ifndef FLUXY_SESSION_STORE_H
#define FLUXY_SESSION_STORE_H

#include <time.h>

#define SESSION_STORE_MAX 2000

void session_create(int userId, char tokenOut[49]);

int session_user_id_from_auth_header(const char *headers);

void session_invalidate_all_for_user(int userId);

void reset_token_create(int userId, int ttlSeconds, char tokenOut[49]);

int reset_token_user_id(const char *token);

void reset_token_mark_used(const char *token);

#endif
