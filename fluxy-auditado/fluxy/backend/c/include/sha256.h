#ifndef FLUXY_SHA256_H
#define FLUXY_SHA256_H

#include <stddef.h>

#define SHA256_HASH_ROUNDS 120000

typedef struct {
    unsigned int state[8];
    unsigned long long bits;
    unsigned char buf[64];
    size_t len;
} sha256_ctx;

void sha256_init(sha256_ctx *ctx);
void sha256_update(sha256_ctx *ctx, const unsigned char *data, size_t n);
void sha256_final(sha256_ctx *ctx, unsigned char out[32]);

void to_hex(const unsigned char *in, size_t n, char *out);

void slow_hash(const char *salt, const char *secret, char out_hex[65]);

void random_hex(char *out, int bytes);

#endif
